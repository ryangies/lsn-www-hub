package WWW::Livesite::Session;
use strict;
our $VERSION = 0;

use Perl::Module;
use Digest::SHA1 qw(sha1_hex);
use Data::Hub::FileSystem::Node;
use Algorithm::KeyGen;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use WWW::Livesite::User;

our %TimeUnitToSeconds = (
  s => 1,
  m => 60,
  h => 60 * 60,
  D => 60 * 60 * 24,
  M => 60 * 60 * 24 * 30,
  Y => 60 * 60 * 24 * 30 * 12,
);

our $KeyGen = Algorithm::KeyGen->new(33, 'a-zA-Z0-9');

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {}, $class;
  my $sid = shift;
  unless ($KeyGen->validate($sid)) {
    $sid and $Hub->{'/sys/log'}->error("Client sent an invalid SID: $sid");
    $sid = $KeyGen->create();
  }
  $self->set_sid($sid);
  $self;
}

sub set_sid {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->{user} = undef;
  $self->{credentials} = undef;
  my $sid = shift or throw Error::MissingArg '$sid';
  $self->{SID} = $sid;
  $self->{directory} = $Hub->vivify("/sys/tmp/sessions/$sid");
  $self->{data} = $self->{directory}->vivify("data.json");
  $self->{tmp} = $self->use_tmp(1);
  tied(%{$self->{directory}})->__hub(tied(%$Hub));
  tied(%{$self->{directory}})->__access_log($Hub->fs_access_log());
  $self;
}

sub use_tmp {
  my $self = shift;
  my $only_if_exists = shift;

  # The cookie key which indicates the browser session is still active
  my $cookie_key = $self->{directory}->str('tmp_cookie_key');

  unless ($cookie_key) {
    # We have never used temporary storage before
    return if $only_if_exists;
#warn "TMP: genkey\n";
    $cookie_key = $KeyGen->create();
    $self->{directory}->set('tmp_cookie_key', $cookie_key)->save();
  }

#warn "TMP: cookie=$cookie_key\n";

  unless ($$Hub{"/sys/request/cookies/$cookie_key"}) {
    # The browser session has expired or this is the first time.
    if (exists $self->{directory}{'tmp.json'}) {
      # clean-up previous session data
#warn "TMP: cleanup\n";
      $self->{directory}->delete('tmp.json');
      $self->{directory}->save();
    }
    return if $only_if_exists;
#warn "TMP: send-cookie\n";
    $$Hub{"/sys/response/cookies/$cookie_key"} = 1;
  }

#warn "TMP: vivify\n";
  # Return the fs data node for temp data
  $self->{tmp} = $self->{directory}->vivify('tmp.json');
}

sub is_active {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->{directory} && $self->{directory}->get_mtime;
}

sub get_user {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->{'user'};
}

sub get_auth_token {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  my $tokens = $Hub->vivify('/sys/tmp/auth_tokens.json');
  unless ($tokens->get($self->{SID})) {
    $Hub->{'/sys/log'}->warn('Generating new auth token for session: ', $self->{SID});
    $tokens->set($self->{SID}, sha1_hex(rand(2**16).time()));
    $tokens->save();
  }
  $self->{'auth_token'} = $tokens->str($self->{SID});
}

sub remove_auth_token {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  my $tokens = $Hub->vivify('/sys/tmp/auth_tokens.json');
  $tokens->delete($self->{SID});
  $tokens->save();
}

sub get_timeout {
  my $self = shift;
  $Hub->get('/sys/conf/handlers/auth/timeout') || '+10m';
}

sub get_timeout_seconds {
  my $self = shift;
  my $timeout = $self->get_timeout;
  my $seconds = 0;
  if ($timeout && $timeout =~ /^\+?(\d+)([YMDhms]?)$/ && $TimeUnitToSeconds{$2}) {
    $seconds = $1 * $TimeUnitToSeconds{$2};
  } else {
    $Hub->{'/sys/log'}->error("Illegal auth-timeout config value");
  }
  return $seconds;
}

# ------------------------------------------------------------------------------
# login - 
#
# Note this method sets a "session" cookie which holds the credentials. 
#
# XXX: When FireFox restores your tabs, it also restores these session cookies.
# http://stackoverflow.com/questions/777767/firefox-session-cookies
# ------------------------------------------------------------------------------

sub login {
  my $self = shift;
  croak "Illegal call to instance method" unless ref($self);
  # Username (un) and hashed password (sha1(sha1(pw)+token))
  my ($un, $h2) = @_;
  if ($self->_is_valid($un, $h2)) {
    # Store their information
    my ($k, $v) = $self->_set_credentials($un, $h2);
    # Set the cookie key and value for subsequent requests
    $Hub->{"/sys/response/cookies/$k"} = $v;
    # Save the cookie key which links the session with the cookie
    $self->{directory}->save();
    $self->{directory}->set('auth_cookie_key', $k)->save();
    # Authenticate this session for this request
    $self->{'user'} = WWW::Livesite::User->new($un);
    $Hub->{'/sys/log'}->info('Successful login for session: ' . $self->{SID});
    return 1;
  } else {
    $Hub->{'/sys/log'}->info('Invalid login for session: ' . $self->{SID});
    return 0;
  }
  undef;
}

# ------------------------------------------------------------------------------
# auto_login - For scripts to escalate the current anonymous user.
# auto_login $un, $pw
#  $un - username
#  $pw - sha1 encrypted password
# ------------------------------------------------------------------------------

sub auto_login {
  my $self = shift;
  my ($un, $h1) = @_;
  # Do not invalidate an existing login
  my $u = $self->get_user;
  my $uid = $u ? $u->get_username : '';
  $uid and return $uid eq $un;
  # The 'auto' part means we will hash the encryped password
  my $tk = $self->get_auth_token();
  my $h2 = sha1_hex(join(':', $h1, $tk));
  $self->login($un, $h2);
}

# ------------------------------------------------------------------------------
# _is_valid - Do the supplied credentials match those on file?
# ------------------------------------------------------------------------------

sub _is_valid {
  my $self = shift;
  my ($un, $h2) = @_;
  my ($acct, $h1) = _get_account($un);
  return unless $acct && $h1;
  my $tk = $self->get_auth_token();
# my $h2_correct = sha1_hex(join(':', $h1, $tk));
# $Hub->{'/sys/log'}->debug("AUTH: tk=$tk");
# $Hub->{'/sys/log'}->debug("AUTH: un=$un");
# $Hub->{'/sys/log'}->debug("AUTH: h1=$h1");
# $Hub->{'/sys/log'}->debug("AUTH: h2=$h2");
# $Hub->{'/sys/log'}->debug("AUTH:  ==$h2_correct");
  $h2 eq sha1_hex(join(':', $h1, $tk));
}

# ------------------------------------------------------------------------------
# _set_credentials - Store the provided un and pw in a random file.
# ------------------------------------------------------------------------------

sub _set_credentials {
  my $self = shift;
  my ($un, $h2) = @_;
  my $k = $KeyGen->create();
  my $v = $KeyGen->create();
  my $creds = {
    'un' => $un,
    'h2' => $h2,
    'SID' => $self->{SID},
    'mtime' => time,
  };
  $Hub->set("/sys/tmp/credentials/$v.json", $creds)->save();
  ($k, $v);
}

# ------------------------------------------------------------------------------
# _get_credentials - 
# ------------------------------------------------------------------------------

sub _get_credentials {
  my $self = shift;
  my $k = $self->{directory}->str('auth_cookie_key') or return;
  my $v = $Hub->get("/sys/request/cookies/$k") or return;
  my $vv = $v->value;
  my $h = $Hub->get("/sys/tmp/credentials/$vv.json") or return;
  return unless $$h{'SID'} eq $self->{'SID'};
  $h;
}

# ------------------------------------------------------------------------------
# logout - 
# ------------------------------------------------------------------------------

sub logout {
  my $self = shift;
  croak "Illegal call to instance method" unless ref($self);
  # Our user member is no longer valid
  $self->{'user'} = undef;
  # Only remove credentials when they are valid for this session
  if (my $h = $self->_get_credentials) {
    file_remove($h->get_path);
  }
  # Break the connection (always)
  $self->{directory}->delete('auth_cookie_key');
  $self->{directory}->save();
  # Remove the hashing token for this session (a new one will be created
  # when needed)
  $self->remove_auth_token();
}

# ------------------------------------------------------------------------------
# authenticate - 
# ------------------------------------------------------------------------------

sub authenticate {
  my $self = shift;
  croak "Illegal call to instance method" unless ref($self);

  # Already authenticated sessions will not invoke the checking mechanism.
  # This allows requests (like ones which call L</login>) to accept credentials
  # and run under those priviledges.  Otherwise, the client must send us the
  # correct auth cookie.
  return $self->{'credentials'} if $self->{'user'};

  my $cred = $self->_get_credentials or do {
#   $Hub->{'/sys/log'}->debug('No credentials for session: ' . $self->{SID});
    return;
  };
  if ($$cred{mtime}) {
    # Requests which do not require authentication will not update the 
    # authenticated mtime.
    my $expires = $$cred{mtime} + $self->get_timeout_seconds;
    my $now = time;
    if ($expires < $now) {
      $self->logout();
      $Hub->{'/sys/log'}->warn('Session has expired');
      return;
    }
  } else {
    $Hub->{'/sys/log'}->error('Missing mtime in credentials');
    $self->logout();
    return;
  }
  if ($$cred{un}) {
    my ($acct, $h1) = _get_account($$cred{un});
    unless ($acct && $h1) {
      $Hub->{'/sys/log'}->warn('No account for: ', $$cred{un});
      return;
    }
    my $tk = $self->get_auth_token();
#   $Hub->{'/sys/log'}->debug("Authenticate: $$cred{un}:$h1:$tk");
    my $h2 = sha1_hex(join(':', $h1, $tk));
    if ($$cred{'h2'} eq $h2) {
      $self->{'credentials'} = {
        'username' => $cred->str('un'),
        'groups' => $acct->str('groups'),
      };
      $self->{'user'} = WWW::Livesite::User->new($cred->str('un'));
      $$cred{mtime} = time;
      $cred->save();
      return $self->{'credentials'};
    } else {
      $Hub->{'/sys/log'}->warn(' password mismatch');
      return;
    }
  } else {
    $Hub->{'/sys/log'}->warn('Authenticate: missing username');
  }
  undef;
}

# ------------------------------------------------------------------------------
# _get_account - 
# ------------------------------------------------------------------------------

sub _get_account {
  my $un = shift;
  my $users = $Hub->{'/sys/users'} or return ();
  my $user = $users->{$un} or return ();
  my $h1 = $user->{'password.sha1'};
  chomp $h1;
  ($user, $h1);
}

1;

__END__

=pod:summary Server-side session object

=pod:synopsis

  Internal usage.

=pod:description

  Creating a Session
  ------------------
  
  A session is required for authentication.
  
  Initial Request without SID cookie
  
    The server will generate a new SID, which is valid for any length of time
    according to the server configuration.
  
    The cookie key is dynamic according to the host and connection.
  
    <== Set-Cookie: <sid-key>=<SID>
  
  Subsequent requests MUST include the session cookie.
  
    ==> <sid-key>=<SID>
  
  Authentication
  --------------
  
  Any unauthenticated request requiring authorization
  
    <== 403 Unauthorized
  
  Client MUST obtain the authentication token:
  
    URL /res/login/module.pm/get_nonce
    <== <auth-token>
  
  Client should capture user credentials (Login Dialog)
  
  Request authentication
  
    URL /res/login/module.pm/login)
    ==> un=<username>
    ==> h2=sha1(sha1(<password>) + ':' + <auth-token>)
  
    When the credentials match:
  
    <== 200 Success
  
    Otherwise:
  
    <== 500 Login Failed; nonce=<auth-token>
  
=pod:cut
