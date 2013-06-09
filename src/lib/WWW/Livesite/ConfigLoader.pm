package WWW::Livesite::ConfigLoader;
use strict;
our $VERSION = 0;

use Perl::Module qw();
use List::Util qw(max);
use Data::Hub qw($Hub);
use Data::Hub::FileSystem::Node;
use WWW::Livesite::Config;

# ------------------------------------------------------------------------------
# new - Construct and initialze the /sys/conf hash.
# new
# ------------------------------------------------------------------------------

sub new {
  my $classname = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {
    conf => WWW::Livesite::Config->new(),
    nodes => [],
    mtime => 0,
  }, $classname;
  $self;
}

# ------------------------------------------------------------------------------
# get_mtime - Get the latest modified time of all the config overlays.
# get_mtime
# 
# Returns the max file-system mtime from the config overlay from when it was
# loaded.
# ------------------------------------------------------------------------------

sub get_mtime {
  return $_[0]->{mtime};
}

# ------------------------------------------------------------------------------
# overlay - Overlay a config path onto the current structure.
# overlay $path
# where:
#   $path # is the ABSOLUTE path to a file or directory
# ------------------------------------------------------------------------------

sub overlay {
  my $self = shift;
  my $path = shift;
  my $node = Data::Hub::FileSystem::Node->new($path, tied(%$Hub));
  push @{$self->{nodes}}, $node;
  $self->{conf}->overlay($node);
  $self->{mtime} = max($self->{mtime}, $node->get_mtime);
  $self->{conf};
}

# ------------------------------------------------------------------------------
# refresh - Check each config overlay for changes and load them if necessary.
# refresh
# ------------------------------------------------------------------------------

sub refresh {
  my $self = shift;
  my $reload = 0;
  foreach my $node (@{$self->{nodes}}) {
    $reload ||= $node->refresh;
    $Hub->{'/sys/log'}->debug(
      sprintf('ConfigLoader: reload=%d: %s', $reload, $node->get_path));
  }
  if ($reload) {
    $self->{conf}->clear();
    foreach my $node (@{$self->{nodes}}) {
      $self->{mtime} = max($self->{mtime}, $node->get_mtime);
      $self->{conf}->overlay($node);
    }
  }
  $reload;
}

sub write_value {
  my $self = shift;
  my $addr = shift or die 'Missing param: address';
  my $hash = shift or die 'Missing param: hash';
  my @nodes = @{$self->{nodes}};
  my $node = pop @nodes or die "No configuration file found";
  my $base = shift @nodes; # do not set here

  for (reverse @nodes) {
    if ($_->get($addr)) {
      $node = $_;
      last;
    }
  }

  $node->set($addr, $hash);
  $node->save;
}

sub write_hash {goto \&write_value}

sub write_array {goto \&write_value}

1;
