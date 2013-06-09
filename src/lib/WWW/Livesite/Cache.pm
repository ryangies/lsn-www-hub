package WWW::Livesite::Cache;
use strict;

our $VERSION = 1.3;
# 1.3   Added URI scheme to request-tag creation (Request.pm)
# 1.2   Add check for max-age caching header
# 1.1   Only consider GET requests cache-able
# 1.0   Removed 'X-Forwarded-For', 'X-Content-Format', 'X-Content-Encoding' 
#       from rtag_str
# 0.9   Fixing webkit local cache not triggering iframe onload
# 0.8   Honor refs to missing file deps.
# 0.7   Update to Hub responder: no more http caching
# 0.6   Update to Hub responder: subset -> branch
# 0.5   Fixed merge to use original send_file if set
# 0.4   Fixed fs_access_log for iterated directories
# 0.3   Updated request/response tag generation
# 0.2   Continued development 
# 0.1   Initial version

use Perl::Module;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(FS);
use base qw(Data::Hub::Container);
use HTTP::Date qw(str2time);

# ------------------------------------------------------------------------------
# new - Creates an empty object.
# ------------------------------------------------------------------------------

sub new {
  my $pkg = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {
    'rtag' => undef,
    'meta' => undef,
    'mtime' => undef,
    'requests' => $Hub->vivify("/sys/tmp/response/cache/requests"),
    'responses' => $Hub->vivify("/sys/tmp/response/cache/responses"),
  }, $pkg;
  $self;
}

# ------------------------------------------------------------------------------
# load - Loads a cache-info object from disk.
# ------------------------------------------------------------------------------

sub load {
  my $self = shift;
  my $req = $$Hub{'/sys/request'} or return;
  my $rtag = $req->get_rtag or return;
# $$Hub{'/sys/log'}->info("CACHE: loading $rtag");
  my $meta = $$self{'requests'}->get("$rtag/meta.json") or return;
# $$Hub{'/sys/log'}->info("CACHE: found");
  return unless $$meta{'ver'} eq $VERSION; # use string comparison
# $$Hub{'/sys/log'}->info("CACHE: version ok");
  $$self{'meta'} = $meta;
  $$self{'rtag'} = $rtag;
# $$Hub{'/sys/log'}->info("CACHE: loaded $rtag");
  $self;
}

# ------------------------------------------------------------------------------
# get_header - Return a single header from the cached response (must be loaded)
# get_header $name
# ------------------------------------------------------------------------------

sub get_header {
  my $self = shift;
  my $name = shift;
  my $headers = $$self{'meta'}{'headers'};
  for (@$headers) {
    my ($k, $v) = @$_;
    if ($k eq $name) {
      return $v;
    }
  }
  undef;
}

# ------------------------------------------------------------------------------
# merge - Takes the loaded response and sticks it into the system hash.
# ------------------------------------------------------------------------------

sub merge {
  my $self = shift;
  my $resp = $$Hub{'/sys/response'};
  # Headers
  my $headers = $$self{'meta'}{'headers'};
  for (@$headers) {
    my ($k, $v) = @$_;
    $$resp{'headers'}{$k} = $v;
  }
  # Last-modified time
  $$resp{'mtime'} = $self->get_mtime;
  # Content
  my $etag = $$self{'meta'}{'etag'};
  my $send_file = $$self{'meta'}{'send_file'};
  unless ($send_file) {
    my $content = $$self{'responses'}{$etag} or return;
    $send_file = $content->get_path;
  }
  $$resp{'send_file'} = $send_file or return;
  $$resp{'can_cache'} = 1;
  $$resp{'etag'} = $etag;
  $self;
}

# ------------------------------------------------------------------------------
# update - Update the access info for this cache entry.
# ------------------------------------------------------------------------------

sub update {
  my $self = shift;
  return unless $$self{'meta'};
  $$self{'meta'}{'acount'}++;
  $$self{'meta'}{'atime'} = time;
  $$self{'meta'}->save();
  $self;
}

# ------------------------------------------------------------------------------
# save - Saves the current response as a cache-info object.
# ------------------------------------------------------------------------------

sub save {
  my $self = shift;
  my $req = $$Hub{'/sys/request'};
  my $resp = $$Hub{'/sys/response'};
  $$Hub{'/sys/log'}->debug('CACHE: ', '->save');
  return $self->purge unless $self->_can_store($resp);
  my $acount = 0;
  if ($$self{'meta'}) {
    my $etag = $$self{'meta'}{'etag'} || 'W/0';
    my $resp_etag = $$resp{'etag'} || 'W/1';
    $$Hub{'/sys/log'}->debug('CACHE: etag1:', $etag);
    $$Hub{'/sys/log'}->debug('CACHE: etag2:', $resp_etag);
    return $self->update if $resp_etag eq $etag;
    $acount = ++$$self{'meta'}{'acount'}; # Prerve access count
  }
  $$Hub{'/sys/log'}->debug('CACHE: purge:');
  $self->purge;
  $$Hub{'/sys/log'}->debug('CACHE: store stuff:');
  if ($self->_store_response_entity($resp)) {
    $self->_store_request_map($req, $resp, $acount);
  }
  $self;
}

# ------------------------------------------------------------------------------
# purge - Remove the data files from disk.
# ------------------------------------------------------------------------------

sub purge {
  my $self = shift;
  $$Hub{'/sys/log'}->debug('CACHE: ', '->purge');
  my $rtag = $$self{'rtag'} or return;
  my $meta = $$self{'meta'} or return;
  my $etag = $$meta{'etag'};
  # Remove data
  delete $$self{'requests'}{$rtag};
  $$self{'requests'}->save();
  if ($etag) {
    delete $$self{'responses'}{$etag};
    $$self{'responses'}->save();
  }
  # Reset internal state
  undef $$self{'rtag'};
  undef $$self{'meta'};
  undef $$self{'mtime'};
  return;
}

# ------------------------------------------------------------------------------
# _can_store - Does the response support caching.
# ------------------------------------------------------------------------------

sub _can_store {
  my $self = shift;
  my $resp = shift;
  my $req = $$Hub{'/sys/request'} or return;
  return unless $$req{'method'} eq 'GET';
  return unless $$resp{'can_cache'};
  if (my $cc = $resp->{'headers'}{'Cache-Control'}) {
    return if $cc =~ /(no-cache|no-store)/;
  }
  1;
}

sub _store_response_entity {
  my $self = shift;
  my $resp = shift;
  my $etag = $resp->get_etag;
  my $raw = str_ref($resp->{'body'});
  return unless defined $$raw;
  $$self{'responses'}->set($etag, $raw)->save();
}

sub _store_request_map {
  my $self = shift;
  my $req = shift;
  my $resp = shift;
  my $acount = shift || 0;
  my $path = undef;
  my $mtime = undef;
  my $rtag = $req->get_rtag or die;
  if ($$resp{'send_file'}) {
    $path = $$resp{'send_file'};
    my $stat = stat($path) or die;
    $mtime = $stat->mtime;
  } elsif (my $res = $$resp{'res'}) {
    if (isa($res, FS('Node'))) {
      $path = $res->get_path;
      $mtime = $res->get_mtime;
    } else {
      my $addr = $$resp{'addr'};
      my $storage = $Hub->addr_to_storage($addr) or die 'No storage for resource';
      $path = $storage->get_path;
      $mtime = $storage->get_mtime;
    }
  }
  my @headers = grep {$_->[0] !~ /^(Set-Cookie|Last-Modified)$/}
    $resp->{'headers'}->as_array;
  my $meta = {
    'rtag_str' => $$req{'rtag_str'},
    # Compile information needed for a has-it-been-modified check.
    'ver' => $VERSION,
    'uri' => $$req{'uri'},
    'qs' => $$req{'qs'}->to_string,
    'path' => $path,
    'send_file' => $$resp{'send_file'},
    'mtime' => $mtime,
    'deps' => $$resp{'fs_access_log'},
    'cfg_mtime' => $Hub->{'/sys/cfgldr'}->get_mtime,
    # If it hasn't been modified, then go ahead send the headers we store here 
    # and the file denoted by its etag (or send_file).
    'headers' => \@headers,
    'etag' => $resp->get_etag,
    # A reaper script should purge caches which are not being used
    'atime' => time, # last-access time
    'ctime' => time, # created (last-compiled) time
    'acount' => $acount, # access count
  };
  $$self{'requests'}->set("$rtag/meta.json", $meta)->save;
}

# ------------------------------------------------------------------------------
# get_mtime - Return the last-modified time if the cache is valid.
# Return 0 in undef situations such that numeric comparisons can be done.
# ------------------------------------------------------------------------------

sub get_mtime {
  my $self = shift;
  my $result = 0;
  $$self{'mtime'} and return $$self{'mtime'};
  # the target file
  if (my $path = $$self{'meta'}{'path'}) {
    my $mtime = $$self{'meta'}{'mtime'} or return 0;
    my $stat = stat $path or return 0;
    if ($stat->mtime <= $mtime) {
      $result = $stat->mtime;
    } else {
      return 0;
    }
  }
  # files accessed during the compilation
  my $deps = $$self{'meta'}{'deps'};
  foreach my $path (keys %$deps) {
    my $mtime = $deps->{$path};
    my $stat = stat $path;
    next if !$mtime && !$stat; # wasn't there before, isn't there now
    if ($stat && $stat->mtime <= $mtime) {
      $result = max($result, $stat->mtime);
    } else {
      return 0;
    }
  }
  # server configuration
  if ($result) {
    my $cache_cfg_mtime = $$self{'meta'}{'cfg_mtime'};
    my $cfg_mtime = $Hub->{'/sys/cfgldr'}->get_mtime;
    if (!$cache_cfg_mtime || $cfg_mtime > $cache_cfg_mtime) {
      return 0;
    } else {
      $result = max($result, $cache_cfg_mtime);
    }
  }
  # cache control
  my $max_age = undef;
  if (my $cc = $self->get_header('Cache-Control')) {
    # split
#   $$Hub{'/sys/log'}->info("CACHE: Cache-Control is: $cc");
    ($max_age) = $cc =~ /(?:s-)?max-age=['"]?(\d+)['"]?/;
    if ($max_age) {
      my $ctime = $$self{'meta'}{'ctime'} || $result;
      my $age = time - $ctime;
#     $$Hub{'/sys/log'}->info("CACHE: Cache-Control uses max-age : $age > $max_age");
      return 0 if $age > $max_age;
#     $$Hub{'/sys/log'}->info("CACHE: Cache-Control uses max-age : CAN USE CACHE");
    }
  }
  # expiry
  # Note: if a response includes a Cache-Control field with the max-
  #       age directive (see section 14.9.3), that directive overrides the
  #       Expires field.
  my $expires = $self->get_header('Expires');
  if (!$max_age && defined $expires) {
    my $time = str2time($expires) || 0;
    return 0 if !$time || (time > $time);
  }
  return $$self{'mtime'} = $result;
}

1;
