package WWW::Livesite::User;
use strict;
our $VERSION = 0;

use Perl::Module;
use Error::Programatic;
use Error::Logical;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use base qw(Data::CompositeHash);

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $un = shift || 'guest';
  my $acct_key = addr_normalize('/sys/users/' . $un);
  throw Error::Security unless index($acct_key, '/sys/users/') == 0;
  my $acct = $Hub->{$acct_key} || {};
  my $self = $class->SUPER::new($acct);
  $self->unshift({
    un => $un,
    id =>  sub { $self->get_username(@_); },
    is_admin => sub { $self->is_admin(@_); },
  });
  $self;
}

sub get_username {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->{un};
}

sub get_groups {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->{groups};
}

sub is_admin {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  $self->is_member('admins');
}

sub is_member {
  my $self = shift;
  throw Error::NotStatic unless isa($self, __PACKAGE__);
  my $group = shift or throw Error::MissingArg;
  my $groups = $self->{groups} or return;
  $groups = $groups->to_string if can($groups, 'to_string');
  $groups =~ /\b$group\b/;
}

1;

__END__
