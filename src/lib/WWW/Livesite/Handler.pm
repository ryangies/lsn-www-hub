package WWW::Livesite::Handler;
use strict;
our $VERSION = 0.1;

use Perl::Module;
use Error::Programatic;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);

our %MATCH = ();

# $_[0] - The URI
# $_[1] - The resource (file-system node)
# $_[2] - The value operand

$MATCH{'typeof'} = sub {$_[1] && typeof($_[0], $_[1]) eq $_[2]};
$MATCH{'typeof_match'} = sub {$_[1] && typeof($_[0], $_[1]) =~ $_[2]};
$MATCH{'uri'} = sub {$_[0] eq $_[2]};
$MATCH{'uri_match'} = sub {$_[0] =~ $_[2]};

$MATCH{'qs_match'} = sub {
  my $qs = $Hub->get('/sys/request/qs');
  $qs->to_string() =~ $_[2];
};

$MATCH{'param'} = sub {
  my ($uri, $res, $value) = @_;
  my $param = $Hub->get('/sys/request/qs');
  foreach my $k (keys %$value) {
    my $match_v = $$value{$k};
    my $param_v = $$param{$k};
    return unless $match_v eq $param_v;
  }
  1;
};

$MATCH{'param_match'} = sub {
  my ($uri, $res, $value) = @_;
  my $param = $Hub->get('/sys/request/param');
  foreach my $k (keys %$value) {
    my $match_v = $$value{$k};
    my $param_v = $$param{$k};
    return unless $param_v =~ /$match_v/;
  }
  1;
};

$MATCH{'xargs'} = sub {
  my ($uri, $res, $value) = @_;
  my $xargs = $Hub->get('/sys/request/xargs');
  foreach my $k (keys %$value) {
    my $match_v = $$value{$k};
    my $xarg_v = $$xargs{$k};
    return unless $match_v eq $xarg_v;
  }
  1;
};

$MATCH{'xargs_match'} = sub {
  my ($uri, $res, $value) = @_;
  my $xargs = $Hub->get('/sys/request/xargs');
  foreach my $k (keys %$value) {
    my $match_v = $$value{$k};
    my $xarg_v = $$xargs{$k};
    return unless $xarg_v =~ /$match_v/;
  }
  1;
};

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {
    'spec' => shift,        # Hash specification
    'class' => undef,       # Implementing class
    'crit' => [],           # Compiled criteria functions
    'match_request' => undef,  # Class match method (has precedence)
  }, $class;
  $self->load;
  $self;
}

sub load {
  my $self = shift;
  if (my $class = $$self{'spec'}{'class'}) {
    eval "use $class";
    $@ and die $@;
    $$self{'class'} = $class;
  } elsif (my $module = $$self{'spec'}{'module'}) {
    my $m = $$self{'module'} = $Hub->get($module);
    die "Invalid module: $module\n" unless isa($m, FS('PerlModule'));
  } else {
    die "Invalid handler";
  }
  foreach my $k (keys %MATCH) {
    my $v = $$self{'spec'}{$k};
    defined $v and push @{$$self{'crit'}}, [$MATCH{$k}, $v];
  }
  if (my $match_method = $$self{'spec'}{'match_method'}) {
    my $m = $Hub->get($match_method);
    die "Invalid match method" unless isa($m, 'CODE');
    push @{$$self{'crit'}}, [$m];
  }
  if (can($$self{'class'}, 'match_request')) {
    no strict qw(refs);
    my $sub = $$self{'class'} . '::match_request';
    $$self{'match_request'} = \&$sub;
  }
}

sub get_instance {
  my $self = shift;
  my $uri = shift;
  my $res = shift;
# $$Hub{'/sys/log'}->debug(
#   sprintf('Trying responder: %s for %s (%s)', $$self{'class'}, $uri, 
#     typeof($uri, $res))
# );
  return unless $self->match($uri, $res);
  $$Hub{'/sys/log'}->debug(sprintf('TRACE: Using responder: %s', $$self{'class'}));
  return $$self{'class'}
    ? $$self{'class'}->new($uri, $res)
    : $$self{'module'}{'new'}($uri, $res);
}

sub match {
  my $self = shift;
  my $uri = shift;
  my $res = shift;
  if (my $sub = $$self{'match_request'}) {
    return 1 if &$sub($uri, $res);
  }
  foreach my $m (@{$$self{'crit'}}) {
    my $sub = $m->[0];
    my $v = $m->[1];
    return unless &$sub($uri, $res, $v);
  }
  1;
}

1;
