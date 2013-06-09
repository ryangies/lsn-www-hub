package WWW::Livesite::Config;
use strict;
our $VERSION = 0;

use Perl::Module qw();
use Data::Hub::Container qw(curry);
use base qw(Data::OrderedHash);

sub new {
  my $self = shift->SUPER::new();
  curry($self->clear());
}

sub overlay {
  my $self = shift;
  my $node = shift;
  Perl::Module::overlay($self, $node, -keep_order);
}

sub clear {
  my $self = shift;
  %$self = (sys_tmp_dir => '/tmp');
  $self;
}

1;
