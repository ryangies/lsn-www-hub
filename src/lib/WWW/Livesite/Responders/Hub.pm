package WWW::Livesite::Responders::Hub;
use strict;
use Encode;
use Error qw(:try);
use LWP::UserAgent;
use Fcntl qw(:flock);
use Perl::Module;
use Perl::Util qw(:const);
use Error::Programatic;
use Error::Logical;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;
our %Commands = ();

# ------------------------------------------------------------------------------
# new - Construcotr
# new $uri, $res
#
# This responder conforms to the /api namespace specification.  Where the URI
#
#   /api/hub/fetch
# 
# indicates a request to invoke 'fetch' on the 'hub' (this) responder.
#
# Parameters:
#
#   target       Target address
# ------------------------------------------------------------------------------

sub new {
  my $pkg = ref($_[0]) ? ref(shift) : shift;
  my $self = $pkg->SUPER::new(@_);
  my @addr = addr_split($$self{'uri'});
  $self->{'verb'} = $addr[2]; # current command (stateful)
  $self->{'params'} = undef; # input parameters (required)
  $self->{'result'} = undef; # output location (stateful)
  $$Hub{'/sys/log'}->debug(sprintf('HUB: uri=%s, verb=%s', $$self{uri}, $$self{verb}));
  $self;
}

sub get_permission_mode {
  my $self = shift;
  'x'; # must have execute permission to use this responder
}

sub can_upload {
  my $self = shift;
  $self->{'verb'} eq 'upload';
}

# If the responder can handle uploads for this request, insert our progress
# meter (input filter).
#  - When using a reverse-proxy like Nginx, uploads are spooled.
#  - libapreq2 has a mechanism for this, is it worth migrating to?
sub get_input_filter {
  my $self = shift;
  return $self->{'verb'} eq 'upload'
    ? __PACKAGE__ . '->rif_upload'
    : undef;
}

sub max_post_size {
  my $self = shift;
  # TODO - Glean values from configuration
  $self->{'verb'} eq 'upload' ? ONE_MB * 500 : ONE_MB * 2;
}

# ------------------------------------------------------------------------------
# rif_upload - Request Input Filter for Uploads (record bytes read)
# See also: Apache2::UploadStatus
#
# Server configuration:
#
#   /sys/conf/debug/slow_upload => .3
#
#     Seconds (via sleep) that the input filter waits while reading the request
#     body. This slows down the reading of uploaded data. Used to debug 
#     client-side upload progress indicators.
#
#     Note this doesn't work behind a reverse proxy (such as NGiNX) as it 
#     handles the client upload.
# ------------------------------------------------------------------------------

sub rif_upload {
  my ($class, $f, $bb, $mode, $block, $readbytes) = @_;
  $$Hub{'/sys/log'}->set_request($f->r);
  my $xfrid = $Hub->{'sys'}{'response'}->get('tmp/xfrid');
  if (!$xfrid) {
    $$Hub{'/sys/log'}->debug('TRANSFER: File-upload was not initialized, progress reporting disabled');
    return Apache2::Const::DECLINED;
  }
  my $ctx = $f->ctx || {
    state => 'uploading',
    mtime => 0,
    size => $f->r->headers_in->get('Content-Length') || 0,
    received => 0,
    slow_upload => $$Hub{'/sys/conf/debug/slow_upload'},
  };
  my $status = $f->next->get_brigade($bb, $mode, $block, $readbytes);
  return $status unless $status == APR::Const::SUCCESS;
  $ctx->{received} += $bb->length;
  # Do not write stats more than once per second
  if (!$ctx->{'mtime'} || (time - $ctx->{'mtime'}) > 1
      || $$ctx{'received'} == $$ctx{'size'}) {
    $ctx->{'mtime'} = time;
    $Hub->{'sys'}{'tmp'}->set("xfr/$xfrid.hf", $ctx)->save();
  }
  $f->ctx($ctx);
  if ($$ctx{'slow_upload'}) {
    $$Hub{'/sys/log'}->warn(sprintf('TRANSFER: [%s] received %d of %d',
      $xfrid, $$ctx{'received'}, $$ctx{'size'}));
    sleep(.3);
  }
  return Apache2::Const::OK;
}

sub compile {
  my $self = shift;
  $Hub->{'/sys/request'}->assert_same_origin();
#
# TODO - This requires all modules which use hub.js to include the auth-token
#
# $Hub->{'/sys/request'}->assert_auth_token();
  my $cgi = $Hub->get('/sys/request/cgi') or die;
  my $resp = $Hub->get('/sys/response') or die;
  $self->run($cgi, $resp);
  $resp->{'headers'}{'Cache-Control'} = 'no-cache, no-store';
  $resp->format;
}

sub run {
  my $self = shift;
  my $verb = $self->{'verb'};
  my $sub = $Commands{$verb} or throw Error::Logical('No such command');
  $self->{'params'} = shift;
  $self->{'result'} = shift;
  $self->{'result'}->set('/head/verb', $verb);
  try {
    &$sub($self);
  } catch Error::AccessDenied with {
    # We do not want to trap this exception as it will trigger the login dialog
    shift->throw;
  } catch Error with {
    # Error::DoesNotExist
    # Error::Logical
    # Error::MissingArg
    # Error::Programatic
    # Error
    $self->set_error(@_);
  } otherwise {
    $self->set_error($@);
  };
  $self->{'result'};
}

sub set_error {
  my $self = shift;
  my $ex = shift;
  my $ex_class = ref($ex);
  my $ex_message = $ex_class
    ? can($ex, 'message')
      ? $ex->message()
      : $ex->{'-text'}
    : $ex;
  $$Hub{'/sys/log'}->error($ex_message);
  my $error = {
    'type' => $ex_class,
    'message' => $ex_message,
  };
  $self->{'result'}->set('/head/error', $error);
}

# ------------------------------------------------------------------------------
# check_auth - Is the session authorized to run the specified command
# check_auth $ura
# check_auth $ura, 'w'
#
#   r   read - one can see the compiled version
#   v   value - one can see the uncompiled (source) version
#   q   query - one can query the resource, e.g., list directory contents
# ------------------------------------------------------------------------------

sub check_auth {
  my $self = shift;
  my $ura = shift;
  my $mode = shift || '';
  $mode .= 'rvq';
  throw Error::AccessDenied("($mode) for: $ura")
    unless $Hub->{'/sys/perms'}->is_session_authorized($ura, $mode);
  1;
}

sub get_target {
  my $self = shift;
  my $ura = $$self{'params'}{'target'}
    or throw Error::Logical('Missing target address');
  $ura;
}

# ==============================================================================
# Commands
# ==============================================================================

$Commands{'batch'} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $cgi = $$self{'params'};
  my $body = [];
  my %orig = map { $_ => $$self{$_} } ('verb', 'result', 'params');
  foreach my $params ($cgi->values()) {
    my $verb = $$params{'verb'};
    my $result = Data::Hub::Container->new();
    $$self{'verb'} = $verb;
    $self->run($params, $result);
    push @$body, $result;
  }
  $resp->set('/head/struct', 'subset');
  $resp->set('/body', $body);
# $resp->set('/debug', $cgi);
  ($$self{$_} = $orig{$_}) for ('verb', 'result', 'params');
};

sub _prev_key {
  my $self = shift;
  my $ura = shift;
  my $parent_addr = addr_parent($ura);
  if ($parent_addr) {
    my $key = addr_name($ura);
    my $parent_value = $Hub->get($parent_addr);
    my @keys = $parent_value->keys;
    my $idx = grep_first_index(sub {$_ eq $key}, @keys);
    if ($idx > 0) {
      return $keys[$idx - 1];
    }
  }
  undef;
}

# ------------------------------------------------------------------------------
# fetch - Fetch a resource
# ------------------------------------------------------------------------------

$Commands{'fetch'} = sub {
  my $self = shift;
  my $ura = shift || $self->get_target();
  my $args = $$self{'params'};
  my $resp = $$self{'result'};
  my $raddr = $args->{root} || '/';
  throw Error::Programatic 'Queries not yet implemented'
    if is_abstract_key($ura);
  throw Error::Logical "Address outside of root: $ura"
    unless index($ura, $raddr) == 0;
# $self->{rnode} ||= $raddr == '/' ? $Hub : $Hub->get($raddr);
# my $relative_addr = substr $ura, length($raddr);
  if ($args->{'branch'}) {
    $resp->set('/head/struct', 'branch');
    my $results = $$resp{'body'} = [];
    my $relative_addr = substr $ura, length($raddr);
    my @addr = addr_split($relative_addr);
    my $root = Data::Hub::Container->new();
    $self->_fetch_into($root, $raddr);
    push @$results, $root;
    my $addr = $raddr;
    for (@addr) {
      $addr = addr_normalize($addr . '/' . $_);
      my $body = Data::Hub::Container->new();
      $self->_fetch_into($body, $addr);
      push @$results, $body;
    }
  } else {
    $self->_fetch_into($resp, $ura);
  }
};

sub _typeof {
  my $addr = shift;
  my $value = shift;
  my $type = typeof($addr, $value);
  $type .= '-mount' if $addr ne '/' && $Hub->is_mount($addr);
  $type;
}

sub _fetch_into {
  my $self = shift;
  my $struct = shift;

# Just found the opposite, that this decoding was breaking on a new filename... maybe
# something changed (Ryan 11/2012)
# my $addr = Encode::decode('utf8', shift); # key names using extended chars
  my $addr = shift;

  $self->check_auth($addr);
# my $value = $self->{rnode}->get($addr);
  my $value = $Hub->get($addr);
  my $storage = isa($value, FS('Node')) ? $value : $Hub->find_storage($addr);
  throw Error::Logical('Cannot find storage: ' . $addr)
    unless isa($storage, FS('Node'));
  $struct->set('/head/meta/addr', $addr);
  throw Error::DoesNotExist($addr) unless defined($value);
  $struct->set('/head/meta/type', _typeof($addr, $value));
  $struct->set('/head/meta/mtime', $storage->get_mtime);
  $struct->set('/head/meta/size', isa($value, FS('Node')) ? $value->get_stat->size : undef);
  if (isa($value, 'CODE')) {
    $struct->{body} = &$value(%{$$self{'params'}});
  } else {
    my $prev_key = $self->_prev_key($addr);
    $struct->set('/head/meta/prev', $prev_key) if defined $prev_key;
    if (isa($value, FS('Directory'))) {
      $struct->{body} = Data::OrderedHash->new();
      if ($addr eq '/') {
        # Add mounted directories to root index
        foreach my $k (keys %$Hub) {
          my $v = $$Hub{$k};
          my $type = _typeof("/$k", $v);
          next unless $type eq 'directory-mount';
          # TODO - Glean from config: special folders
          next if $k eq 'ext';
          next if $k eq 'desktop';
          $struct->{body}->{$k} = {
            type => $type,
            addr => $v->get_addr,
            mtime => $v->get_mtime,
            size => $v->get_stat->size,
            length => $v->length(),
          };
        }
      }
      foreach my $k ($value->keys) {
        my $v = $value->{$k};
        $struct->{body}->{$k} = {
          addr => $v->get_addr,
          type => _typeof($v->get_addr, $v),
          mtime => $v->get_mtime,
          size => isa($v, FS('Node')) ? $v->get_stat->size : undef,
          length => $v->length(),
        };
      }
    } elsif (isa($value, FS('Node'))) {
      $struct->{body} = $value->get_data;
      if (isa($value, FS('TextFile'))) {
        # Only send text content for files less than one megabyte.  This is an
        # ugly protection against large binary files which appear as text files.
        #
        # One example is a .run file which starts out like a shell script, however
        # has a tar gizpped footer to it... This needs to be covered in the
        # Binary/text file detection (Data::Hub::Util).
        if ($value->get_stat->size < ONE_MB) {
          # preferred as UA may split on __DATA__ if so desired
          my $content = str_ref(clone($value->get_raw_content));
          chomp $$content;
          $struct->set('/head/meta/content', $content);
          $struct->set('/head/meta/checksum', checksum($$content));
        }
      }
    } else {
      $struct->{body} = $value;
    }
  }
}

# ------------------------------------------------------------------------------
# store - Store a value
# ------------------------------------------------------------------------------

$Commands{'store'} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $params = $$self{'params'};
  my ($ura, $value, $mtime, $origin) = @$params{'target', 'value', 'mtime', 'origin'};
  $self->check_auth($ura, 'w');
  throw Error::Programatic('Invalid mtime') if $mtime && $mtime !~ /^\d+$/;
  throw Error::Logical('Undefined value') unless defined $value;
  my $storage = $Hub->find_storage($ura);
  throwf Error::Logical('Not a storable resource: %s', $ura) unless $storage;
  if ($mtime && $storage->get_mtime > $mtime) {
    throw Error::Logical('File has been modified')
      if (!defined $origin) || ($Hub->get($ura) ne $origin);
  }
  $Hub->set($ura, $value);
  $storage->save();
  my $name = addr_name($ura);
  if ($name eq '<next>') {
    my $parent_addr = addr_parent($ura);
    my $parent = $Hub->get($parent_addr);
    my $index = isa($parent, 'ARRAY') ? $#$parent : $name;
    $ura = addr_join($parent_addr, $index);
  }
  &{$Commands{fetch}}($self, $ura);
};

# ------------------------------------------------------------------------------
# update - Update values
# ------------------------------------------------------------------------------

$Commands{'update'} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $params = $$self{'params'};
  my ($ura, $values, $mtime, $origins)
    = @$params{'target', 'values', 'mtime', 'origins'};
  $self->check_auth($ura, 'w');
  throw Error::Programatic('Invalid mtime') if $mtime && $mtime !~ /^\d+$/;
  throw Error::Logical('Undefined values') unless defined $values;
  throw Error::Logical('Values is not a hash') unless isa($values, 'HASH');
  throw Error::Logical('Origin is not a hash') if defined $origins && !isa($origins, 'HASH');
  my $storage = $Hub->find_storage($ura);
  throwf Error::Logical('Not a storable resource: %s', $ura) unless $storage;
  if ($mtime && $storage->get_mtime > $mtime) {
    my $conflict = 0;
    if (defined $origins) {
      foreach my $k (keys %$values) {
        if ($Hub->get("$ura/$k") ne $$origins{$k}) {
          $conflict = 1;
          last;
        }
      }
    } else {
      $conflict = 1;
    }
    $conflict and throw Error::Logical('File has been modified');
  }
  foreach my $k (keys %$values) {
    $Hub->set("$ura/$k", $$values{$k});
  }
  $storage->save();
  &{$Commands{fetch}}($self, $ura);
};

# ------------------------------------------------------------------------------
# reorder - Reorder keys
# ------------------------------------------------------------------------------

$Commands{reorder} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $ura = $self->get_target();
  $self->check_auth($ura, 'w');
  my $value = $$self{'params'}{'value'};
  throw Error::Logical('Undefined value') unless defined $value;
  my $storage = $Hub->addr_to_storage($ura)
    or throwf Error::Logical('Not a storable resource: %s', $ura);
  throw Error::Logical('Value must be an ARRAY') unless isa($value, 'ARRAY');
  my $target = $Hub->get($ura);
  if (can($target, 'sort_by_key')) {
    my %old_to_new = ();
    my $i = 0;
    ($old_to_new{$_} = $i++) for @$value;
    $target->sort_by_key(sub {$old_to_new{$_[0]} <=> $old_to_new{$_[1]}});
    $resp->set('/body', [$target->keys]);
  } elsif (isa($target, 'HASH')) {
    throw Error::Logical('Target datum cannot be ordered');
  } elsif (isa($target, 'ARRAY')) {
    # The value for re-ordering is an array which is in proper order.  The
    # value for each item is the original (current) index.  For instance,
    # a 3-element array which has been reversed would be:
    #
    #   [0] = 2   # what was at index 2 is now 0
    #   [1] = 1   # what was at index 1 is still 1
    #   [2] = 0   # what was at index 0 is now 2
    #
    # When an array item is deleted, the client cannot be responsible for
    # decrementing the index (as it does not know enough to decrement each
    # child's address).  If the second element is deleted, and then the array
    # is reversed, it will look like this:
    #
    #   [0] = 2   # what was at index 2 is now 0
    #   [1] = 0   # what was at index 0 is now 1
    #
    # The issue is that on our side, there is no longer an index 2 as it is
    # now at position 1.
    #
    #   map1  map2  map3  map4  keys
    #   n c   n c   c n   c n   c             n=new c=current
    #   ----  ----  ----  ----  ----
    #   0:5   2:0   0:2   4:0   4
    #   1:4   3:2   1:3   3:1   3
    #   2:0   4:3   2:4   0:2   0
    #   3:2   1:4   3:1   1:3   1
    #   4:3   0:5   4:0   2:4   2
    #
    my $i = 0;
    my @map1 = map { [$i++, $_] } @$value;
    my @map2 = sort {$$a[1] <=> $$b[1]} @map1;
    $i = 0;
    my @map3 = map { [$i++, $$_[0]] } @map2;
    my @map4 = sort {$$a[1] <=> $$b[1]} @map3;
    my @keys = map { $$_[0] } @map4;

#warn "REORDER: value=" . join ('|', @$value);
#warn "REORDER:  map1=" . join ('|', map { $$_[0] . ':' . $$_[1] } @map1);
#warn "REORDER:  map2=" . join ('|', map { $$_[0] . ':' . $$_[1] } @map2);
#warn "REORDER:  map3=" . join ('|', map { $$_[0] . ':' . $$_[1] } @map3);
#warn "REORDER:  map4=" . join ('|', map { $$_[0] . ':' . $$_[1] } @map4);
#warn "REORDER:  keys=" . join ('|', @keys);

    my @values = map { $$target[$_] } @keys;
    @$target = @values;
    $resp->set('/body', \@keys);
  } else {
    throw Error::Logical('Ordering not supported');
  }
  $storage->save();
  $resp->set('/head/meta/addr' => $ura);
  $resp->set('/head/meta/type' => _typeof($ura, $target));
  $resp->set('/head/meta/mtime' => $storage->get_mtime);
# &{$Commands{fetch}}($self);
};

# ------------------------------------------------------------------------------
# create - Create a new node
# ------------------------------------------------------------------------------

our %Create = (); # Create routines

$Commands{create} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $args = $$self{'params'};
  my $ura = $self->get_target();
  $self->check_auth($ura, 'w');
  $args->{paddr} = $ura;
  throw Error::Logical 'Illegal parent' if is_abstract_key($args->{paddr});
  $args->{parent} = $Hub->get($args->{paddr});
  throw Error::Logical 'No parent' unless defined $args->{parent};
  throw Error::MissingArg 'name' unless defined $args->{name};
  throw Error::MissingArg 'type' unless $args->{type};
  my $sub = $Create{$args->{type}}
    or throwf Error::Logical("Type not supported: %s", $args->{type});
  my $res = &$sub($args);
  # TODO - To support <next> key (for appending to an array), we need
  # to set {addr} here (with the correct key).
  throwf Error::Logical("Failed to create: %s", $args->{addr})
    unless defined $res;
  &{$Commands{fetch}}($self, $args->{addr});
};

$Create{'directory'} = sub {
  my $args = shift;
  _validate_target_dir($args);
  # Does not support $args->{value}
  my $result = $Hub->vivify($args->{addr}, FS('Directory'))->save();
  $args->{parent}->reload;
  return $result;
};

$Create{'file-text'} = sub {
  my $args = shift;
  _validate_target_dir($args);
  my $result = undef;
  if (my $value = $args->{value}) {
    $result = $Hub->set($args->{addr}, $value)->save();
  } else {
    $result = $Hub->vivify($args->{addr}, FS('TextFile'))->save();
  }
  $args->{parent}->reload;
  return $result;
};

$Create{'data-hash'} = sub {
  my $args = shift;
  _validate_target_container($args);
# my $hash = can($args->{storage}, 'sort_by_key')
#   ? Data::OrderedHash->new() : {};
# $Hub->set($args->{addr}, $hash);
  my $value = $args->{value} || {};
  my $result = $Hub->set($args->{addr}, $value);
  $args->{storage}->save();
  return $result;
};

$Create{'data-array'} = sub {
  my $args = shift;
  _validate_target_container($args);
  my $value = $args->{value} || [];
  my $result = $Hub->set($args->{addr}, $value);
  $args->{storage}->save();
  return $result;
};

$Create{'data-scalar'} = sub {
  my $args = shift;
  _validate_target_container($args);
  my $value = defined $args->{value} ? $args->{value} : '';
  my $result = $Hub->set($args->{addr}, $value);
  $args->{storage}->save();
  return $result;
};

# ------------------------------------------------------------------------------
# insert - Insert a new array item
# ------------------------------------------------------------------------------

$Commands{insert} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $args = $$self{'params'};
  my $paddr = $self->get_target();
  my $src = $args->{'src'};
  my $index = $args->{'index'};
  $self->check_auth($paddr, 'w');
  throw Error::MissingArg 'src' unless defined $src;
  throw Error::MissingArg 'index' unless defined $index;
  throw Error::Logical 'Illegal parent' if is_abstract_key($paddr);
  my $parent = $Hub->get($paddr);
  throw Error::Logical 'No parent' unless defined $parent;
  throw Error::Logical 'Invalid parent' unless isa($parent, 'ARRAY');
  throw Error::Logical 'Illegal index' unless is_numeric($index);
  throw Error::Logical 'Index out of range' if abs($index) > @$parent;
  my $src_node = $Hub->get($src);
  throw Error::Logical 'Undefined source node' unless defined $src_node;
  my $storage = $Hub->addr_to_storage($paddr);
  throw Error::Logical('Not a storable resource') unless $storage;
  splice @$parent, $index, 0, clone($src_node, -keep_order);
  $storage->save();
  &{$Commands{fetch}}($self, $paddr);
};

# ------------------------------------------------------------------------------
# remove - Remove a resource
# ------------------------------------------------------------------------------

$Commands{remove} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $ura = $self->get_target();
  $self->check_auth($ura, 'w');
  throw Error::Logical 'Illegal address' if is_abstract_key($ura) || $ura eq '/';
  my $value = $Hub->get($ura);
  throw Error::Logical('Undefined value') unless defined $value;
  throw Error::Logical('Location mismatch') unless $ura eq addr_normalize($ura);
  my $storage = $Hub->addr_to_storage(addr_parent($ura));
  throw Error::Logical('Unstoreable item') unless $storage;
#$$Hub{'/sys/log'}->info("XXX:  ura: $ura");
#$$Hub{'/sys/log'}->info("XXX: addr: " . $storage->get_addr);
  throw Error::Logical('Out of bounds') unless index($ura, $storage->get_addr) == 0;
  $resp->set('/head/meta/addr' => $ura);
  $resp->set('/head/meta/type' => _typeof($ura, $value));
  $Hub->delete($ura);
  $storage->save();
  $resp->set('/head/meta/mtime' => $storage->get_mtime);
};

$Commands{'rename'} = sub {

  my $self = shift or die;
  my $resp = $$self{'result'} or die;

  my $old_addr = $self->get_target();
  throw Error::Logical 'Illegal address' if is_abstract_key($old_addr) || $old_addr eq '/';
  throw Error::Logical('Location mismatch') unless $old_addr eq addr_normalize($old_addr);

  my $old_name = addr_name($old_addr);
  my $new_name = $$self{'params'}{'name'};
  throw Error::MissingArg 'name' unless defined $new_name;

  my $parent_addr = addr_parent($old_addr);
  $self->check_auth($parent_addr, 'w');

  my $new_addr = addr_join($parent_addr, $new_name);
  throw Error::Logical('Location mismatch') unless addr_parent($new_addr) eq $parent_addr;
  throw Error::Logical 'Source is destination' if $old_addr eq $new_addr;
  throw Error::Logical 'Target exists' if $Hub->get($new_addr);

  my $parent = $Hub->get($parent_addr);
  throw Error::Logical('Undefined parent') unless defined $parent;
  throw Error::Logical('Illegal parent') if isa($parent, 'ARRAY');

  my $storage = $Hub->addr_to_storage($parent_addr);
  throw Error::Logical('Unstoreable item') unless $storage;
  throw Error::Logical('Out of bounds') unless index($old_addr, $storage->get_addr) == 0;

  my $target = $Hub->get($old_addr) or throw Error::DoesNotExist;
  if (can($parent, 'rename_entry')) {
    # Data::Hub::FileSystem::Directory
    # Data::Hub::FileSystem::HashFile
    # Data::OrderedHash
    $parent->rename_entry($old_name, $new_name);
    $storage->save();
  } else {
    $$parent{$new_name} = delete $$parent{$old_name};
    $storage->save();
  }

  my $prev_key = $self->_prev_key($new_addr);
  $resp->set('/head/meta/prev', $prev_key) if defined $prev_key;
  $resp->set('/head/meta/addr', $parent_addr);
  $resp->set('/head/meta/old_name', $old_name);
  $resp->set('/head/meta/old_addr', $old_addr);
  $resp->set('/head/meta/new_name', $new_name);
  $resp->set('/head/meta/new_addr', $new_addr);
  $resp->set('/head/meta/storage_addr', $storage->get_addr);
};

# ------------------------------------------------------------------------------
# move/copy - Move or copy a resource
# ------------------------------------------------------------------------------

$Commands{copy} = sub {$_[0]->_mvcp()};
$Commands{move} = sub {$_[0]->_mvcp(1)};

sub _mvcp {
  my $self = shift;
  my $opt_mv = shift;
  my $resp = $$self{'result'};
  my $args = $$self{'params'};
  my $ura = $self->get_target();
  throw Error::MissingArg 'dest' unless defined $args->{dest};
  my $src_addr = $ura;
  my $new_addr = addr_normalize($args->{dest});
  my $new_paddr = addr_parent($new_addr);
  my $new_name = addr_name($new_addr);
  throw Error::Logical 'Illegal address' if $src_addr eq '/';
  throw Error::Logical 'Illegal address' if is_abstract_key($src_addr);
  throw Error::Logical 'Illegal address' if is_abstract_key($new_addr);
  throw Error::Logical 'Source is destination' if $src_addr eq $new_addr;
  $self->check_auth($new_paddr, 'w');
  my $source = $Hub->get($src_addr);
  my $target = $Hub->get($new_paddr);
  throw Error::Logical "Source missing" unless defined $source;
  throw Error::Logical "Target missing" unless defined $target;
  if (isa($source, FS('Node'))) {
    throw Error::Logical "Type mismatch" unless isa($target, FS('Directory'));
    my $src_path = $source->get_path;
    my $new_path = $target->get_path . '/' . $new_name;
    throw Error::Logical "Target exists" if -e $new_path;
    if (isa($source, FS('File'))) {
      file_copy($src_path, $new_path);
      $opt_mv and file_remove($src_path) if -e $new_path;
    } else {
      # dir_move is NOT used here because dir_copy will ignore the .svn folders
      # which is needed such that the subversion desktop module will delete the 
      # old and add the the new.
      dir_copy($src_path, $new_path);
      $opt_mv and dir_remove($src_path) if -d $new_path;
    }
    $target->reload();
  } else {
    throw Error::Logical "Type mismatch"
      if (isa($target, 'SCALAR') || !ref($target));
    $target->set($new_name, clone($source, -keep_order));
    if (isa($target, 'ARRAY') && $new_name eq '<next>') {
      $new_addr = $new_paddr . '/' . $#$target;
    }
    $opt_mv and $Hub->delete($src_addr) if defined($Hub->get($new_addr));
    $Hub->addr_to_storage($new_paddr)->save();
  }
  # Return the parent collection
  $resp->set('/head/destination', $new_addr);
  $resp->set('/head/source', $src_addr);
  &{$Commands{fetch}}($self, $new_paddr);
}

# ------------------------------------------------------------------------------
# _init_xfr - Common transfer init for upload and download
# ------------------------------------------------------------------------------

sub _init_xfr {
  my $self = shift;
  my $resp = $$self{'result'};
  my $ura = $self->get_target();
  my $name = $$self{'params'}{'name'} or throw Error::MissingArg 'name';
  my $replace = $$self{'params'}{'replace'} || 0;
  $self->check_auth($ura, 'w');
  my $new_addr = path_normalize($ura . '/' . $name);
  throw Error::Logical 'Path violation' unless index($new_addr, $ura) == 0;
  my $parent = $Hub->{$ura};
  throw Error::Logical 'Invalid parent' unless isa($parent, FS('Directory'));
  throw Error::Logical "Node already exists" if !$replace && $parent->get($name);
  my $new_path = path_normalize($parent->get_path() . '/' . $name);
  my $progress_id = $$Hub{'/sys/request/xargs/X-Progress-ID'};
  my $id = $Hub->{'/sys/response/tmp/xfrid'} = $progress_id || checksum($ura, $name);
  $Hub->set("/sys/tmp/xfr/$id.hf", {'state' => 'starting'})->save();
  $$Hub{'/sys/log'}->debug(sprintf('TRANSFER: [%s] initialized', $id));
  return ($id, $new_path, $parent);
}

# ------------------------------------------------------------------------------
# upload - Upload a file
#
# We require the poster to provide the name of which the uploaded file will
# assume. Otherwise one would:
#   my $name = $upload->filename();
#   $name =~ s/\\/\//g;
#   $name = path_name($name);
# ------------------------------------------------------------------------------

$Commands{upload} = sub {
  my $self = shift;
  my ($id, $new_path, $parent) = $self->_init_xfr();
  try {
    my $upload = $Hub->{'/sys/request/obj'}->upload('file') or
      throw Error::Logical('No content for upload parameter: file');
    my $spool_path = $upload->tempname();
    file_copy($spool_path, $new_path);
  } finally {
    $Hub->set("/sys/tmp/xfr/$id.hf/state", 'done');
    $Hub->get("/sys/tmp/xfr/$id.hf")->save();
  };
  if (-e $new_path) {
    $parent->reload();
    $$Hub{'/sys/response/headers/Status'} = 'HTTP/1.1 204 Upload complete';
  } else {
    $$Hub{'/sys/log'}->error(sprintf('TRANSFER: [%s] failed: %s', $id, $new_path));
    throw Error::Logical "Uploaded file does not exist";
  }
};

# ------------------------------------------------------------------------------
# download - Download a file from the given URI
# ------------------------------------------------------------------------------

$Commands{download} = sub {
  my $self = shift;
  my $resp = $$self{'result'};
  my $uri = $$self{'params'}{'uri'} or throw Error::MissingArg 'uri';
  my ($id, $new_path, $parent) = $self->_init_xfr();
  my $ua = LWP::UserAgent->new;
  $ua->timeout(5);
  my $max = $self->max_post_size;
  my ($sz, $rec) = (0, 0);
  my $fh = IO::File->new($new_path, 'w') or die "$!: $new_path";
  flock $fh, LOCK_EX or die $!;
  binmode $fh;
  try {
    $$Hub{'/sys/log'}->debug("TRANSFER: [$id] Fetch $uri");
    my $mtime = 0;
    my $r = $ua->get($uri,
      ":content_cb" => sub {
        my ($chunk, $response, $protocol) = @_;
        $sz ||= $response->content_length;
        $rec += length $chunk;
        if ($sz > $max || $rec > $max) {
          throw Error::Logical "Requested download is too large";
        }
        print $fh $chunk;
        if (!$mtime || (time - $mtime) > 1) {
          # Do not write stats more than once per second
          $mtime = time;
          $Hub->set("/sys/tmp/xfr/$id.hf", {
            size      => $sz,
            received  => $rec,
            state     => 'downloading',
          })->save();
          $$Hub{'/sys/log'}->debug(
            sprintf('TRANSFER: [%s] received %d of %d', $id, $rec, $sz)
          );
        }
      }
    );
    $$Hub{'/sys/log'}->debug("TRANSFER: [$id] Fetch complete");
    die $r->status_line unless $r->is_success;
    $$resp{'body'} = $r;
    $Hub->set("/sys/tmp/xfr/$id.hf/state", 'done');
  } otherwise {
    $Hub->set("/sys/tmp/xfr/$id.hf/state", 'failed');
  } finally {
    flock $fh, LOCK_UN;
  };
  $Hub->{"/sys/tmp/xfr/$id.hf"}->save();
};

# ------------------------------------------------------------------------------
# upload_progress - Inquire about a running file transfer
# ------------------------------------------------------------------------------

$Commands{upload_progress} = sub { shift->_progress() };

# ------------------------------------------------------------------------------
# download_progress - Inquire about a running file transfer
# ------------------------------------------------------------------------------

$Commands{download_progress} = sub {shift->_progress() };

# ------------------------------------------------------------------------------
# _progress - Common implementation for up/down progress
# ------------------------------------------------------------------------------

sub _progress {
  my $self = shift;
  my $resp = $$self{'result'};
  my $name = $$self{'params'}{'name'};
  my $progress_id = $$Hub{'/sys/request/xargs/X-Progress-ID'}
    or throw Error::MissingArg 'X-Progress-ID';
  $$resp{'body'} = $Hub->{"/sys/tmp/xfr/$progress_id.hf"} or throw Error::DoesNotExist;
}

# ------------------------------------------------------------------------------
# _validate_target_dir - Validate and prepare for a new file-system node
# ------------------------------------------------------------------------------

sub _validate_target_dir {
  my $args = shift;
  throw Error::Logical 'Invalid parent'
    unless isa($args->{parent}, FS('Directory'));
  throw Error::Logical "Node already exists"
    if $args->{parent}->get($args->{name});
  $args->{addr} = addr_normalize($args->{paddr}. '/' . $args->{name});
}

# ------------------------------------------------------------------------------
# _validate_target_container - Validate and prepare for a new datum
# ------------------------------------------------------------------------------

sub _validate_target_container {
  my $args = shift;
  throw Error::Logical 'Invalid parent' unless can($args->{parent}, 'length');
  throw Error::Logical "Node already exists"
    if $args->{parent}->get($args->{name});
  $args->{addr} = addr_normalize($args->{paddr}. '/' . $args->{name});
  $args->{storage} = $Hub->addr_to_storage($args->{paddr});
}

1;
