package WWW::Livesite::Responders::Base;
use strict;
use Perl::Module;
use Perl::Util qw(:const);
use Data::Hub qw($Hub);

our $VERSION = 0.1;

# ------------------------------------------------------------------------------
# new - Constructor
# new $uri, $res
#
# This is a common base-class for response responders.
#
# Response responders are responsible for parsing (if needed) the resource and
# setting the C</sys/response/body> member with a scalar reference to the output
# string.
# ------------------------------------------------------------------------------

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $uri = shift;
  my $res = shift;
  bless {uri => $uri, res => $res}, $class;
}

# ------------------------------------------------------------------------------
# get_permission_mode - The permissions required to invoke this responder.
# Permissions are:
#   r   Read
#   w   Write
#   x   Execute
#   q   Query
#   v   Value (raw output)
# ------------------------------------------------------------------------------

sub get_permission_mode {
  'r';
}

# ------------------------------------------------------------------------------
# can_upload - Can this responder upload data?
# ------------------------------------------------------------------------------

sub can_upload {
  0;
}

# ------------------------------------------------------------------------------
# get_input_filter - Apache2 Request input filter
# ------------------------------------------------------------------------------

sub get_input_filter {
}

# ------------------------------------------------------------------------------
# can_post - Can this responder use data in a POST request?
# ------------------------------------------------------------------------------

sub can_post {
  1;
}

# ------------------------------------------------------------------------------
# max_post_size - When L</can_post>, what is the max size (in bytes) allowed?
# A non-true value indicates there is no limit.
# ------------------------------------------------------------------------------

sub max_post_size {
  ONE_MB * 5;
}

# ------------------------------------------------------------------------------
# compile - Invokation method: Process the request and populate /sys/response
# ------------------------------------------------------------------------------

sub compile {
  my $self = shift;
}

# ------------------------------------------------------------------------------
# create_web_parser - Common method used in derived classes
# ------------------------------------------------------------------------------

sub create_web_parser {
  my $self = shift;
  my $options = {
    headers  => $Hub->get('/sys/response/headers'),
  };
  if (my $x_base_uri = $Hub->get('/sys/request/xargs/X-Base-Uri')) {
    my $scheme = $x_base_uri =~ /^https?$/ ? $x_base_uri : 'http';
    my $hostname = $Hub->get('/sys/request/hostname');
    my $port = $Hub->get('/sys/server/port');
    $$options{'base_uri'} = $scheme . '://' . $hostname;
    $$options{'base_uri'} .= ':' . $port if $port ne '80';
  }
  my $parser = Parse::Template::Web->new($Hub, -opts => $options);
  if (my $directives = $Hub->get('/sys/conf/parser/directives')) {
    foreach my $name ($directives->keys()) {
      my $value = $Hub->get($$directives{$name});
      $parser->set_directive($name, [$value]);
      $Hub->get('/sys/log')->info("Adding directive: $name = $value");
    }
  }
  return $parser;
}

1;
