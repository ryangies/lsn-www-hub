package WWW::Livesite::Request;
use strict;
our $VERSION = 0.1;
use Data::Hub qw($Hub);
use Perl::Module;
use Data::Hub::Util qw(addr_name addr_parent);
use WWW::Livesite::XArgs;
use base qw(Data::Hub::Container);
use HTTP::Date qw(str2time);

sub new {
  my $pkg = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {}, $pkg;
  $self->{'xargs'} = WWW::Livesite::XArgs->new();
  $self->{'qs'} = undef;
  $self->{'uri'} = undef;
  $self->{'page'} = undef;
  $self->{'headers'} = undef;
  $self->{'stack'} = []; # previous [sub]request uri info
  $self->{'depth'} = 0; # subrequests
  $self;
}

# ------------------------------------------------------------------------------
# set_uri - Set the URI of the curent request
#
# Note, /sys/request/uri *must* be that of the current request or sub-request,
# otherwise the response will be cached under the wrong name.
#
# C<qs> must already be set.
# ------------------------------------------------------------------------------

sub set_uri {
  my $self = shift;
  my $uri = shift or return;
  return $uri if $$self{'depth'} && $self->{'uri'} eq $uri;
  $self->{'uri'} = $uri;
  my $qs = $self->{'qs'};
  my $addr = Data::Hub::Address->new($uri);
  $addr->shift(); # remove empty first segment
  my $qstr = $qs->to_string;
  my $href = $uri . ($qstr ? '?' . $qstr : '');
  my $root = $Hub->get('/sys/server/uri');
  my $page = $self->{'page'} = {
    full_uri => $root . $uri,
    uri => $uri,
    href => $href,
    addr => $addr,
    parent => addr_parent($uri),
    name => addr_name($uri),
  };
  push @{$$self{'stack'}}, $page;
  $$self{'depth'}++;
  $uri;
}

# Return 0 in undef situations such that numeric comparisons can be done.
sub get_mtime {
  my $self = shift;
  my $ims = $self->{'headers'}{'If-Modified-Since'} or return 0;
  str2time($ims) || 0;
}

# ------------------------------------------------------------------------------
# get_rtag - Get the unique request tag
# get_rtag
#
# Each request tag (rtag) denotes a unique request.  When a response is 
# generated, it is given an entity tag (etag).  If the response can be cached
# (as per the response headers) then it is stored under its etag filename.  And
# the file-system access log is recorded in a cache-info file which associates 
# the rtag with the etag.  When a subsequent request with the same rtag comes 
# in, and none of the file-system objects have changed, then we are in a not-
# modified state.  If the request specifies an If-Modified-Since HTTP header,
# then a 304 (not-modified) response may be returned.  Otherwise the stored
# file may be sent to the client without invoking the compile process.
# ------------------------------------------------------------------------------

sub get_rtag {
  my $self = shift;
  my $u = $Hub->{'/sys/user'};
  my $un = $u ? $u->get_username : 'anonymous';
  my $qs = $self->{'qs'};
  my $xargs = $self->{'xargs'}->internal;
  my @components = (
    $un,
    $self->{'method'},
    $self->{'scheme'},
    $Hub->str('/sys/server/name'),
    $self->{'uri'},
    (%$qs, %$xargs), # do not sort, order can mean different things
  );
  $$self{'rtag_str'} = join ('|', @components);
  $$self{'rtag'} = checksum($$self{'rtag_str'});
# $$Hub{'/sys/log'}->warn(
#   sprintf "RTAG=%s [%s]: %s\n", $$self{'rtag'}, $$self{'uri'}, $$self{'rtag_str'}
# );
  $$self{'rtag'};
}

# ------------------------------------------------------------------------------
# assert_same_origin - Ensure the refering domain matches the server domain.
# ------------------------------------------------------------------------------

sub assert_same_origin {
  my $self = shift;
  my $hostname = $Hub->str('/sys/server/name');
  if ($hostname !~ /^(127.0.0.1|ANY|ALL)$/i) {
    # Ensure refering domain
    my $referer = $self->{'headers'}{'Referer'} or
      throw Error::Logical('Missing referrer header');
    my ($server) = $referer =~ /^[^:\/]+:\/\/([^:\/]+)/ or
      throw Error::Logical('Invalid referrer header (no server)');
    my ($domain) = $server =~ /([^@]+)$/ or
      throw Error::Logical('Invalid referrer header (no domain)');
    my @referer = reverse split /\./, $domain;
    my @host = reverse split /\./, $hostname;
    throw Error::AccessDenied 'Host mismatch'
      unless ($host[0] eq $referer[0] && $host[1] eq $referer[1]);
  }
}

# ------------------------------------------------------------------------------
# assert_auth_token - Ensure the request provided the correct X-Auth-Token
# ------------------------------------------------------------------------------

sub assert_auth_token {
  my $auth_token = $Hub->str('/sys/session/auth_token')
    or throw Error::AccessDenied 'Not authenticated';
  my $auth_token_param = $Hub->str('/sys/request/xargs/X-Auth-Token')
    or throw Error::AccessDenied 'No authentication token provided';
  throw Error::AccessDenied 'Authentication token mismatch'
    unless ($auth_token eq $auth_token_param);
}

1;

__END__

=pod:summary HTTP Request Hash

=pod:synopsis

=pod:description

=cut
