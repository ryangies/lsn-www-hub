package WWW::Livesite::Parameters;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(curry);
use Data::OrderedHash;
use Tie::Hash;
use base qw(Tie::ExtraHash Data::Hub::Courier);
our $VERSION = 0;

# OO interface

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {}, $class;
  tie %$self, $class, @_;
  $self;
}

our %LowerValid = (
  9 => 1,
  10 => 1,
  13 => 1,
);

sub filter_printable {
  my $self = shift;
  my $result = '';
  my $k = shift;
  my $v = $$self{$k};
  return unless defined $v;
  for (split //, $v) {
    my $ord = ord;
    next if $ord < 32 && !$LowerValid{$ord};
    $result .= $_;
#warnf "safe: %04d `%s`\n", ord, $_;
  }
  $result;
}

sub get_printable {
  my $self = shift;
  my $k = shift;
  my $v = $$self{$k};
  my $s = $self->filter_printable($k);
  return unless defined($v) && defined($s) && length($s) == length($v);
  $v;
}

our %Validator = ();

sub RE_VALID_EMAIL {qr/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;}
sub RE_PATH        {qr/\//;}
sub RE_DIGITS      {qr/^\d+$/;}

$Validator{'digits'}  = sub { $_[1] =~ RE_DIGITS; };
$Validator{'nopath'}  = sub { $_[1] !~ RE_PATH; };
$Validator{'email'}   = sub { $_[1] =~ RE_VALID_EMAIL; };

sub _validate_custom {
  my $spec = shift;
  my $k = shift;
  my $v = shift;
  if (substr($spec, 0, 1) eq '&') {
    my $sub = $$Hub{$spec}
      or throw Error::Programatic "Missing validator for: $spec";
    isa($sub, 'CODE')
      or throw Error::Programatic "Invalid validator for: $spec";
    return &$sub($k, $v);
  } else {
    return $v =~ $spec;
  }
}

# ------------------------------------------------------------------------------
# get_valid - Get a parameter value only if it passes validation
# ------------------------------------------------------------------------------
#
#   my $value = $params->get_valid('key');
#   my $value = $params->get_valid('key', -type => 'digits'); L<1>
#   my $value = $params->get_valid('key', -regex => /re/);
#   my $value = $params->get_valid('key', -sub => \&validator);
#   my $value = $params->get_valid('key', -list => \@list);
#   my $value = $params->get_valid('key', -min => 1);
#   my $value = $params->get_valid('key', -max => 64);
#
# ------------------------------------------------------------------------------

sub get_valid {
  my $self = shift;
  my $k = shift;
  my $v = $self->get_printable($k);
  return $self->validate_value($k, $v, @_);
}

# ------------------------------------------------------------------------------
# validate_value - Return a value only when it passes validation
#
#   my $value = $params->validate_value('key', 'value');
#   my $value = $params->validate_value('key', 'value', -type => 'digits'); L<1>
#   my $value = $params->validate_value('key', 'value', -regex => /re/);
#   my $value = $params->validate_value('key', 'value', -sub => \&validator);
#   my $value = $params->validate_value('key', 'value', -list => \@list);
#   my $value = $params->validate_value('key', 'value', -min => 1);
#   my $value = $params->validate_value('key', 'value', -max => 64);
#
# Custom validators should be placed in the server configuration.
#
#   handlers => %{
#     validate => %{
#
#       named => %{
#         first_name => spec L<2>
#         last_name => spec L<2>
#       }
#
#       types => %{
#         cc_number => spec L<2>
#         cc_code => spec L<2>
#       }
#
#     }
#   }
#
# The C<named> hash is queried for validating fields with the associated
# name.
#
#   my $fname = $params->validate_value('first_name');
#
# The C<types> hash is used when the code specifies a C<-type> option, and
# will overried any built-in logic for that type.
#
#   my $ccard = $params->validate_value('card_number', -type => 'cc_number');
#
# N<1> Currently defined types are:
#
#   digits    All digits
#   nopath    Does not contain a solidus (/)
#   email     A well-formed email address, as in: postmaster@example.com
#
# N<2> The C<spec> can be either a custom validator which refers to a 
# subroutine (begins with '&'):
#
#   &/web/pm/validate.pm/zipcode
#
# Otherwise, it is considered a regular expression:
#
#   /\d{1,5}/

sub validate_value {

  my $self = shift;
  my $k = shift or return;
  my $v = shift;
  return unless defined $v;

  my $opts = my_opts(\@_, {
    'type' => undef,
    'regex' => undef,
    'sub' => undef,
  });

  my $conf = $$Hub{'/sys/conf/handlers/validate'} || curry({});

  # Run validators
  if (my $spec = $conf->get("named/$k")) {
    return unless _validate_custom($spec, $k, $v);
  }
  if (my $type = $$opts{'type'}) {
    if (my $spec = $conf->get("types/$type")) {
      return unless _validate_custom($spec, $k, $v);
    } elsif (my $sub = $Validator{$type}) {
      return unless &$sub($k, $v);
    }
  }
  if (my $regex = $$opts{'regex'}) {
    return unless $v =~ $regex;
  }
  if (my $sub = $$opts{'sub'}) {
    return unless &$sub($k, $v);
  }
  if (my $list = $$opts{'list'}) {
    return unless defined grep_first_index {$v eq $_} @$list;
  }
  if (my $len = $$opts{'min'}) {
    return unless length(sprintf('%s', $v)) >= $len;
  }
  if (my $len = $$opts{'max'}) {
    return unless length(sprintf('%s', $v)) <= $len;
  }
  $v;
}

# Tie interface

sub TIEHASH {
  my $pkg = shift;
  my $impl = shift;
  return bless [
    Data::OrderedHash->new(),   # Parameters
    $impl,                      # Callback to fetch [or] parameter hash
    0,                          # Has-populated semiphore
  ], $pkg;
}

sub FIRSTKEY {
  $_[0]->__populate;
  my $a = scalar keys %{$_[0][0]};
  each %{$_[0][0]}
}

sub FETCH {
  $_[0]->__populate;
  my $k = $_[1];
  $_[0][0]{$k};
}

sub __populate {
  return if $_[0][2]; # has populated
  $_[0][2] = 1;
  my $impl = $_[0][1];
  if (isa($impl, 'CODE')) {
    $_[0][0] = &$impl();
  } else {
    $_[0][0] = $impl;
  }
}

1;

__END__

=pod:summary Delayed populating of CGI parameters

=pod:synopsis

  use WWW::Livesite::Parameters;

  my $params = WWW::Livesite::Parameters->new(\&sub);
  my $params = WWW::Livesite::Parameters->new(\%hash);
  
  my $value = $$params{'key'}; # Raw value
  my $value = $params->get_valid('key');
  my $value = $params->get_valid('key', -type => 'digits');
  my $value = $params->get_valid('key', -regex => /re/);
  my $value = $params->get_valid('key', -sub => \&validator);

=pod:description

=cut
