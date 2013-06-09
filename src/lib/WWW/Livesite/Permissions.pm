package WWW::Livesite::Permissions;
use strict;
our $VERSION = 0;

use Perl::Module;
use Error::Programatic;
use Data::Hub::Util qw(:all);
use Data::Hub qw($Hub);
use Scalar::Util qw(weaken);
use Parse::StringTokenizer;
use Perl::Class;
use base qw(Perl::Class::Array);

our $Perm_Tokenizer = Parse::StringTokenizer->new();

sub new {
  $_[0]->SUPER::new();
}

sub _log (@) {
  $Hub->{'/sys/log'}->debug('AUTH: ', @_);
}

sub init {
  my $self = shift;
  unless ($self->__->{conf}) {
    @$self = ();
    $self->__->{conf} = $Hub->{'/sys/conf/permissions'};
    if ($self->__->{conf}) {
      weaken $self->__->{conf};
      $self->__->{conf}->iterate(sub {
        _log("init-rule: $_[0] => $_[1]", );
        my $rules = [];
        for ($Perm_Tokenizer->split($_[1])) {
          push @$rules, [/(?:(?:([ug]):([^=]+))|(\*))=([rwxqvRWXQV]{1,5}|ALL|NONE)/];
        }
        push @$self, [$_[0], $rules];
      });
    }
  }
}

# ------------------------------------------------------------------------------
# is_session_authorized - Is this session's user authorized to access C<$path>
#
# Permissions hash:
#
#   $regex => $defs
#
# C<$regex> is matched agains the request uri.
#
# C<$defs> are definions of the form:
#
#   <type>:<name>=<modes>
#
# Where:
#
#   <type>    u|g     Denotes <name> is a user or group
#   <name>            The user or group name
#             *       Matches any user (that does not have a u: or g: rule)
#   <modes>   rwxvq   r=read, w=write, x=execute, v=view, q=query
#             RWXVQ   R=read, W=write, X=execute, V=view, Q=query L<1>
#             ALL     Keyword which GRANTS all permission L<1>
#             NONE    Keyword which DENIES all permission L<1>
#
# The query (q) mode indicates 'fetch' X-Commands may return directory indexes
# and query results, e.g., C</docs/{\.pdf$}>.
#
# The view (v) mode indicates a one may view the content of a document.  This
# is in contrast to read (r) which only allows access the compiled result.  The
# view mode is required for all X-Commands.
#
# N<1> The upper-cased modes and constants cause the searching to finish with
# that rule.
# ------------------------------------------------------------------------------

sub is_session_authorized {
  my $self = shift;
  my $un = $Hub->str('/sys/session/credentials/username');
  my $groups = $Hub->str('/sys/session/credentials/groups');
  $self->is_authorized($un, $groups, @_);
}

sub is_authorized {
  my ($self, $un, $groups, $path, $mode) = @_;
  $self->init();
  my @modes = split //, $mode;
  my $authorized = 0;
  my $matched = 0;
  my $stop = 0;
  _log "--auth: mode='$mode', un='$un', g='$groups', path='$path'";
  for (@$self) {
    my ($re, $rules) = @$_;
    _log " +perm: $re";
    if (my @match_groups = $path =~ $re) {
      $matched++;
      my $other = 1;
      for (@$rules) {
        $authorized = 0;
        my ($ug, $name, $any, $perms) = @$_;
        $name =~ /\$(\d)/ and $name = $match_groups[$1-1];
        _log "  rule: ug=$ug, who=$name, any=$any, rwxqv=$perms";
        next if $ug eq 'u' && $un ne $name;
        next if $ug eq 'g' && $groups !~ /\b$name\b/;
        if ($any) {
          # Meaning anybody else.
          next unless $other;
        } else {
          # We have a valid u: or g: selection, so we are no longer
          # part of the '*' group.
          $other = 0;
        }
        if ($perms eq 'NONE') {
          $stop = 1;
          last;
        } elsif ($perms eq 'ALL') {
          $stop = 1;
          $authorized = 1;
          last;
        } else {
          my $ok = 1;
          ($ok &= $perms =~ /$_/i) for @modes;
          if (uc($perms) eq $perms) {
            $stop = 1;
            $authorized = $ok;
            last;
          }
          next unless $ok;
        }
        $authorized = 1;
        last;
      }
      _log "  stop: ", ($stop ? 'yes' : 'no'), "";
      _log "   y/n: ", ($authorized ? 'YES' : 'NO'), "";
      last if $stop;
    }
  }
  $matched ? $authorized : 1;
}

1;

__END__
