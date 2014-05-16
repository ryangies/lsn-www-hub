package WWW::Livesite::Main;
use strict;
our $VERSION = 0;

use Perl::Module;
use Misc::Stopwatch;
use Data::Hub;
use Data::Hub::Util qw(:all);
use Data::Hub::Container;
use WWW::Livesite::Config;
use WWW::Livesite::ConfigLoader;
use WWW::Livesite::Session;
use WWW::Livesite::Permissions;
use WWW::Livesite::Request;
use WWW::Livesite::Response;
use WWW::Livesite::Handler;
use WWW::Livesite::Cache;

# This is a performance hit when set to a true value. It means that on each
# request we look to see if the configuration files have been modified and if
# so, reload accordingly.
our $ALWAYS_CHECK_CONFIG = 1;

# ------------------------------------------------------------------------------
# new - Constructor
# new $doc_root
# where:
#   $doc_root   <Absolute Path>   DocumentRoot for the current Location.
# ------------------------------------------------------------------------------

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $doc_root = shift or die;
  my $self = bless {}, $class;
  $self->{hub} = Data::Hub->new($doc_root);
  $self->_export_hub();
  $self->{mounts} = [];
  $self->{sys} = $self->{hub}{sys};
  $self->{sys}{cfgldr} = WWW::Livesite::ConfigLoader->new();
  $self->{sys}{conf} = $self->{sys}{cfgldr}{conf};
  $self->{sys}{tmp} = undef;
  $self->{sys}{perms} = undef;
  $self->{sys}{users} = undef;
  $self->{sys}{log} = undef;
  $self->{sys}{stopwatch} = undef;
  $self->{sys}{request} = WWW::Livesite::Request->new();
  $self->{sys}{response} = WWW::Livesite::Response->new();
  $self->{sys}{session} = undef;
  $self->{responders} = undef;
  $self->{forbidden} = [];
  $self->{ignored} = [];
  $self->{caught_error} = undef; # indicates a 550 response is okay
  $self->{node} = undef;
  $self->{res} = undef;
  $self->{rr} = undef;
  $self->{use_cache} = undef;
  $self->{cache} = undef;
  $self;
}

# ------------------------------------------------------------------------------
# recycle - Called when this application is being reused.
# recycle
# Reset instance members appropriately.
# ------------------------------------------------------------------------------

sub recycle {
  my $self = shift;
  $self->_export_hub();
  $self->{hub}->expire;

  if ($ALWAYS_CHECK_CONFIG) {
    $self->post_conf_init if $self->{sys}{cfgldr}->refresh;
  }

  $self->{sys}{tmp} and $self->{sys}{tmp}->free;
  $self->{sys}{request} = WWW::Livesite::Request->new();
  $self->{sys}{response} = WWW::Livesite::Response->new();
  $self->{node} = undef;
  $self->{res} = undef;
  $self->{rr} = undef;
  $self->{cache} = undef;
}

# ------------------------------------------------------------------------------
# subrequest - Called when this application is invoking a sub-request.
# ------------------------------------------------------------------------------

sub subrequest {
  my $self = shift;
  $self->{sys}{log}->info("New subrequest");
  $self->{sys}{response}->init;
  $self->{node} = undef;
  $self->{res} = undef;
  $self->{rr} = undef;
  $self->{cache} = undef;
}

# ------------------------------------------------------------------------------
# load_config_files - Read and overlay configuration data files
# load_config_files $path_name
# load_config_files @path_names
# 
# XXX This method does not know how to clear the current configuration, so only
# call it once for each package instance.
# ------------------------------------------------------------------------------

sub load_config_files {
  my $self = shift;
  $self->{sys}{cfgldr}->overlay($_) for @_;
  $self->post_conf_init();
}

# ------------------------------------------------------------------------------
# post_conf_init - Initialize things defined in the runtime configuration files
# post_conf_init
#
# 1) Setup mount points
# 2) Setup temp fs
# 3) Setup permission parser and users root
# 4) Instantiate responders
# ------------------------------------------------------------------------------

sub post_conf_init {

  my $self = shift;

  # Mount points
  while (my $m = shift @{$self->{mounts}}) {
    $self->{hub}->umount($m);
  }
  if ($self->{sys}{conf}{mounts}) {
    curry($self->{sys}{conf}{mounts})->iterate(sub {
      die 'System mount is internal' if $_[0] eq '/sys';
      $self->{hub}->mount($_[0], $_[1]);
      push @{$self->{mounts}}, $_[0];
    });
  }

  # Temporary directory
  my $tmp_dir = $self->{sys}{conf}{sys_tmp_dir};
  die "Livesite_Config: 'sys_tmp_dir' must be an absolute path: $tmp_dir"
    unless path_is_absolute($tmp_dir);
  dir_create($tmp_dir);
  $self->{sys}{tmp} = Data::Hub->new($tmp_dir);

  # Forbidden URI's
  $self->{forbidden} = [];
  if (my $forbidden = $self->{sys}->get('conf/handlers/access/forbidden')) {
    $self->{forbidden} = clone($forbidden, -pure_perl);
  }

  # Ignored URI's (do not map finfo)
  $self->{ignored} = [];
  if (my $ignored = $self->{sys}->get('conf/handlers/response/ignore')) {
    $self->{ignored} = clone($ignored, -pure_perl);
  }

  # Permission parser and users root
  $self->{sys}{perms} = WWW::Livesite::Permissions->new();
  if (my $upath = $self->{sys}->get('conf/handlers/auth/users')) {
    die "Livesite_Config: 'handlers/auth/users' must be an absolute path: $upath"
        unless path_is_absolute($upath);
    $self->{sys}{users} = Data::Hub::FileSystem::Node->new(
      $upath, tied(%{$self->{hub}}));
  }

  # Responders.  Add in reverse order so that additional responders are given
  # prescedence.
  if (my $responders = $self->{sys}->get('conf/handlers/response/responders')) {
    $self->{responders} = [];
    for (@$responders) {
      my $rr = WWW::Livesite::Handler->new($_);
      unshift @{$self->{responders}}, $rr;
    }
  }

  # Allow the configuration to disable response caching
  $self->{use_cache} = 1 unless $self->{sys}->get('conf/debug/disable_cache');
}

# ------------------------------------------------------------------------------
# get_config - Helper function to fetch a configuration element.
# get_config $addr
# ------------------------------------------------------------------------------

sub get_config {
  my $self = shift;
  $self->{sys}{conf}->get($_[0]);
}

# ------------------------------------------------------------------------------
# is_forbidden - Is the requested URI forbidden?
# is_forbidden $uri
#
# returns:
#
#   1       Yes, it is forbidden
#   0       No, it is not
#   undef   I don't know, did you pass in a valid URI?
#
# ------------------------------------------------------------------------------

sub is_forbidden {
  my $self = shift;
  my $uri = shift or return;
  return 1 if $uri =~ /^\/sys\b/;
  return 1 if grep_first {$uri =~ /$_/} @{$self->{forbidden}};
  0;
}

# ------------------------------------------------------------------------------
# is_ignored - Is the requested URI ignored?
# is_ignored $uri
#
# returns:
#
#   1       Yes, it is ignored
#   0       No, it is not
#   undef   I don't know, did you pass in a valid URI?
#
# Note that .php files must be ignored in order for them to honor fetching local
# php.ini files and setting ini values in .htaccess.
# ------------------------------------------------------------------------------

sub is_ignored {
  my $self = shift;
  my $uri = shift or return;
  return 1 if $uri =~ /^\/sys\b/;
  return 1 if grep_first {$uri =~ /$_/} @{$self->{ignored}};
  0;
}

# ------------------------------------------------------------------------------
# get_fs_node - Return the Data::Hub::FileSystem object for the current address.
# get_fs_node $addr
# ------------------------------------------------------------------------------

sub get_fs_node {
  my $self = shift;
  my $addr = shift or return $self->{node};
# return $self->{hub}->get_fs_node($addr);
  return if is_abstract_addr($addr);
# $addr =~ s/\/+$// unless $addr eq '/';
  my $node = $self->{hub}->get($addr) or return;
  return unless isa($node, FS('Node'));
  return $self->{node} = $node;
}

# ------------------------------------------------------------------------------
# get_res - Return the resource (node) for the given address.
# get_res $addr
# ------------------------------------------------------------------------------

sub get_res {
  my $self = shift;
  my $addr = shift or return $self->{res};
  $addr =~ s/\/$// unless $addr eq '/';
  return $self->{res} = $self->{hub}->get($addr);
}

# ------------------------------------------------------------------------------
# get_responder - Return the first responder which can handle this request.
# get_responder
# ------------------------------------------------------------------------------

sub get_responder {
  my $self = shift;
  my $addr = shift or return $self->{rr};
  my $res = $self->get_res($addr);
  for (@{$self->{responders}}) {
    if (my $rr = $_->get_instance($addr, $res)) {
      return $self->{rr} = $rr;
    }
  }
  undef;
}

# ------------------------------------------------------------------------------
# is_authorized - True if this session has permissions to complete the request.
# is_authorized
# ------------------------------------------------------------------------------

sub is_authorized {
  my $self = shift;
  my $uri = shift or return;
  my $mode = shift or return;
  $self->{sys}{perms}->is_session_authorized($uri, $mode);
}

# ------------------------------------------------------------------------------
# store_response - Response caching.
# ------------------------------------------------------------------------------

sub store_response {
  my $self = shift;
  return unless $self->{use_cache};
  my $c = $$self{'cache'} ||= WWW::Livesite::Cache->new();
  $c->save();
}

# ------------------------------------------------------------------------------
# get_cache - Response caching.
# ------------------------------------------------------------------------------

sub get_cache {
  my $self = shift;
  return unless $self->{use_cache};
  $$self{'cache'} = WWW::Livesite::Cache->new->load;
}

# ------------------------------------------------------------------------------
# get_cache_mtime - Get the modified time for a valid cached response.
# ------------------------------------------------------------------------------

sub get_cache_mtime {
  my $self = shift;
  my $c = $self->get_cache or return;
  $c->get_mtime;
}

# ------------------------------------------------------------------------------
# update_cache - Update the access info on the cached object.
# ------------------------------------------------------------------------------

sub update_cache {
  my $self = shift;
  my $c = $self->get_cache or return;
  $c->update;
}

# ------------------------------------------------------------------------------
# purge_cache - Purge the cached object.
# ------------------------------------------------------------------------------

sub purge_cache {
  my $self = shift;
  my $c = $self->get_cache or return;
  $c->purge;
}

# ------------------------------------------------------------------------------
# _export_hub - Set the package-global $Data::Hub::Hub (for this process)
# _export_hub
#
# PerlModules access $Hub as:
#
#   use Data::Hub qw($Hub)
#
# which makes them portable, meaning the C<use> line does not change when 
# running outside of the web-server context.
# ------------------------------------------------------------------------------

sub _export_hub {
  my $self = shift;
  $Data::Hub::Hub = $self->{hub};
}

1;

__END__
