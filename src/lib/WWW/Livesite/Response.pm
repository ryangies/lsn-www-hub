package WWW::Livesite::Response;
use strict;
our $VERSION = 0.2;

use Perl::Module;
use Error::Programatic;
use Data::UUID;
use Data::Hub qw($Hub);
use Data::OrderedHash;
use Data::Format::XFR;
use Data::Format::Xml qw(xml_format);
use Data::Format::JavaScript qw(js_format js_format_lsn);
use WWW::Livesite::Headers;
use HTTP::Date qw(time2str);
use Encode ();
use base qw(Data::Hub::Container);
use CSS::Minifier::XS qw();
use JavaScript::Minifier::XS qw();

our $UG = Data::UUID->new();

our %TimeUnitToSeconds = (
  s => 1,
  m => 60,
  h => 60 * 60,
  D => 60 * 60 * 24,
  M => 60 * 60 * 24 * 30,
  Y => 60 * 60 * 24 * 30 * 12,
);

# ------------------------------------------------------------------------------
# new - Create a new object
# ------------------------------------------------------------------------------

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {}, $class;
  $self->init();
}

# ------------------------------------------------------------------------------
# init - Initialise this response object
# ------------------------------------------------------------------------------

sub init {
  my $self = shift;
  %$self = (
    headers => WWW::Livesite::Headers->new(), # HTTP headers
  );
  $self;
}

# ------------------------------------------------------------------------------
# start - Start the response phase
# ------------------------------------------------------------------------------

sub start {
  my $self = shift;
  my $rr = shift or throw Error::MissingArg '$rr';
  $self->{'fs_access_log'} = Data::Hub::Container->new(); # tracks access
  $self->{'fs_change_log'} = Data::Hub::Container->new(); # tracks saves
  $self->{'addr'} = $rr->{uri}; # the URI - TODO update to get_addr
  $self->{'res'} = $rr->{res}; # the object denoted by addr (if one exists)
  $self->{'rr'} = $rr; # the active response responder
  $self->{'cookies'} = {}; # convenience hash for passing along cookies
  $self->{'head'} = undef; # entity headers which will be inserted
  $self->{'body'} = undef; # entity body which will formatted
  $self->{'binmode'} = undef; # the response body is binary data
  $self->{'minify'} = $Hub->get('/sys/conf/handlers/response/minify') || {};
  $self->{'send_file'} = undef; # send this file instead of body
  $self->{'standalone'} = undef; # flag which turns off response parsing and formatting
  $self->{'internal_redirect'} = undef; # uri for internal redirects (no params)
  $self->{'have_sent_headers'} = undef; # flag which indicates headers have been sent
  $self->{'have_sent_body'} = undef; # flag which indicates body has been sent
  $self->{'have_cached'} = undef; # flag which indicates the response-cache has been saved or updated
  $self->{'user_content_type'} = undef; # flag which indicates user specifies type
  $self->{'status'} = undef; # the final status of the response
  $self->{'can_cache'} = undef; # can the compiled output be cached
  $self->{'mtime'} = undef; # the last-modified time of the response
  $self->{'etag'} = undef; # the generated etag for this response
  overlay($self, {@_}, -no_clone);
  $Hub->fs_access_log->add_listener($self->{fs_access_log});
  $Hub->fs_change_log->add_listener($self->{fs_change_log});
  $self;
}

# ------------------------------------------------------------------------------
# stop - Stop the response phase.
# ------------------------------------------------------------------------------

sub stop {
  my $self = shift;
  $Hub->fs_access_log->remove_listener($self->{fs_access_log});
  $Hub->fs_change_log->remove_listener($self->{fs_change_log});
}

# Return an address of the *file* being served (as an array object)
sub get_addr {
  my $res = $Hub->get('/sys/response/res');
  my $page_addr = $res && can($res, 'get_addr')
    ? new Data::Hub::Address($res->get_addr)
    : new Data::Hub::Address();
  return $page_addr;
}

sub get_etag {
  my $self = shift;
  $$self{etag} ||= $self->gen_etag;
}

sub gen_etag {
  my $self = shift;
  $UG->to_string($UG->create());
}

# ------------------------------------------------------------------------------
# get_expires - Get the Expires header value.
#
# XXX Not used - this method currently returns an expires date which is always
# one hour in the past.
# ------------------------------------------------------------------------------

sub get_expires {
  my $self = shift;
  my $now = int(time);
  my $s = $self->get_expires_seconds;
  my $t = $now + $s;
  my $t_str = time2str($t);
  $Hub->{'/sys/log'}->warn("Expires: now=$now; s=$s; t=$t; t_str=$t_str;");
  $t_str;
}

sub get_expires_seconds {
  my $self = shift;
  my $delta = shift || '-1h';
  my $seconds = 0;
  if ($delta =~ /^([+-]?\d+)([YMDhms]?)$/ && $TimeUnitToSeconds{$2}) {
    $seconds = $1 * $TimeUnitToSeconds{$2};
  } else {
    $Hub->{'/sys/log'}->error("Illegal expiry delta: $delta");
  }
  return $seconds;
}

# ------------------------------------------------------------------------------
# format - Serialize the response
# ------------------------------------------------------------------------------

sub format {
  my $self = shift;
  my $accept = 
    $Hub->get('/sys/request/xargs/X-Accept') ||
    $Hub->get('/sys/request/headers/Accept');
  if ($accept eq 'text/data-xfr') {
    $self->format_xfr;
  } elsif ($accept =~ '(text|application)/json') {
    $self->format_json;
  } elsif ($accept eq 'text/json-hash') {
    $self->format_json_compat;
  } else {
    $self->insert_head;
  }
  $self->{'body'};
}

# ------------------------------------------------------------------------------
# encode - Encode the response as specified in the headers
#
# Looks for the charset=??? portion of the Content-Type header.  If it is
# something other than UTF-8, we rewrite the body string with that encoding.
#
# At this point, the body is in perl's utf8 string format. It is true that utf8 
# is different than UTF-8, but I don't know what can be done to upgrade the 
# laxidazical utf8 character set to UTF-8.
# ------------------------------------------------------------------------------

sub encode {
  my $self = shift;
  if (my $ct = $self->{'headers'}{'Content-Type'}) {
    my ($encoding) = $ct =~ /charset=['"]?([^'"\s]+)/i;
    if ($encoding && $encoding ne 'UTF-8') {
      my $ref = str_ref($self->{body});
      my $octets = undef;
      my $length = 0;

      if (utf8::is_utf8($$ref)) {

#       $octets = Encode::encode($encoding, $$ref);
        $octets = Encode::encode('utf8', $$ref);
        $length = Encode::from_to($octets, 'utf8', $encoding);

      } else {

        my $str = Encode::decode('UTF-8', $$ref);
        $octets = Encode::encode($encoding, $str);
        {
          use bytes;
          $length = length($octets);
          no bytes;
        }

      }

      $self->{'length'} = $length;
      $self->{'body'} = \$octets;
    }
  }
}

# ------------------------------------------------------------------------------
# insert_head - Insert head elements.
# insert_head
#
# This method is for use with HTML responses.  The accumulated information in
# the head member is now inserted into the body.  We look for the closing
# head tag, and put them there.  If that tag does not exist, they prefix the
# body.
#
# The html parser directives will write head elements to:
#
#   /sys/response/head/js             Blocks of javascript global code
#   /sys/response/head/css            Blocks of css code
#   /sys/response/head/links/js       Links to javascript files
#   /sys/response/head/links/css      Links to css files
#   /sys/response/head/events/js      Blocks of javascript code by event
#   /sys/response/head/blocks/js      Blocks of javascript closures
#
# XXX Changes made to the /sys/response/head need to be reflected
# in js.lsn.includeHeadJS
# ------------------------------------------------------------------------------

sub minify_css {
  my $self = shift;
  my $code = shift;
  return $$self{'minify'}{'css'}
    ? CSS::Minifier::XS::minify($code)
    : $code;
}

sub minify_js {
  my $self = shift;
  my $code = shift;
  return $$self{'minify'}{'js'}
    ? JavaScript::Minifier::XS::minify($code)
    : $code;
}

sub _quote {
  my $value = shift;
  $value =~ s/(?<!\\)"/\\"/g;
  '"' . $value . '"';
}

sub insert_head {
  my $self = shift;
  my $output = $self->{body} or return;
  my $head_text = '';
  if ($self->{'head'}) {

    # track duplicate src links
    my $have_linked = $self->get('head/have_linked') || {};

    # CSS links
    if ($self->get('head/links/css')) {
      foreach my $attrs_ref (@{ $self->get('head/links/css') }) {
        my %attrs = %$attrs_ref;
        my $href = $attrs{'href'} or next;
        next if $$have_linked{$href};
        $attrs{'rel'} ||= 'stylesheet';
        $attrs{'type'} ||= 'text/css';
        my $attr_str = join ' ', map {$_ . '=' . _quote($attrs{$_})} sort keys %attrs;
        $head_text .= "<link $attr_str/>\n";
        $$have_linked{$href} = 1;
      }
    }

    # CSS blocks
    if ($self->get('head/css')) {
      $head_text .= '<style type="text/css">'."\n"
        . $self->minify_css($self->get('head/css'))
        . '</style>'."\n";
    }

    # JavaScript links
    if ($self->get('head/links/js')) {
      foreach my $attrs_ref (@{ $self->get('head/links/js') }) {
        my %attrs = %$attrs_ref;
        my $src = $attrs{'src'} or next;
        next if $$have_linked{$src};
        $attrs{'type'} ||= 'text/javascript';
        my $attr_str = join ' ', map {$_ . '=' . _quote($attrs{$_})} sort keys %attrs;
        $head_text .= "<script $attr_str></script>\n";
        $$have_linked{$src} = 1;
      }
    }

    my $js_global = $self->get('head/js');
    my $js_extend =  $self->get('head/extend/js');
    my $js_events =  $self->get('head/events/js');
    my $js_blocks =  $self->get('head/blocks/js');
    my $has_js = $js_global || $js_extend || $js_events || $js_blocks;

    if ($has_js) {
      $head_text .= '<script type="text/javascript">/*<![CDATA[*/'."\n";

      # JavaScript extend blocks
      if ($js_extend) {
        $js_extend->iterate(sub {
          my ($ns, $code) = @_;
          $code = $self->minify_js($code);
          $head_text .= "js.extend('$ns',function(js){\n$code\n});\n";
        });
      }

      # JavaScript closure blocks
      if ($js_blocks) {
        $js_blocks->iterate(sub {
          my ($idx, $code) = @_;
          $code = $self->minify_js($code);
          $head_text .= "(function(){\n$code\n})();\n";
        });
      }

      # JavaScript blocks
      if ($js_global) {
        my $code = $self->get('head/js') . "\n";
        $head_text .= $self->minify_js($code);
      }

      # JavaScript event blocks
      if ($js_events) {
        $js_events->iterate(sub {
          my ($target, $events) = @_;
          for (@$events) {
            my $code = $$_{'value'};
            $code = $self->minify_js($code);
            $head_text .=
              "js.dom.addEventListener($target,'$$_{key}',function(event){\n$code\n});\n";
          }
        });
      }

      $head_text .= '/*]]>*/</script>'."\n";
    }

  }
  # Insert
  if ($head_text) {
    chomp $head_text;
    my $p = index_imatch($$output, '\s*<\s*/\s*head\s*>');
    $p = 0 unless ($p > -1); # insert at beginning if no head element
    substr $$output, $p, 0, "\n$head_text";
  }
}

sub format_xfr {
  my $self = shift;
  my $a_enc = $Hub->str('/sys/request/headers/X-Accept-Content-Encoding') || '';
  my $xfr = Data::Format::XFR->new($a_enc);
  my $value = $xfr->format(Data::OrderedHash->new(
    head => $self->{'head'},
    body => $self->{'body'},
  ));
  my $c_enc = $xfr->get_encoding;
  $self->{'headers'}{'Content-Type'} = 'text/data-xfr'; # Needed for older livesite.js
  $self->{'headers'}{'X-Content-Format'} = 'text/data-xfr';
  $self->{'headers'}{'X-Content-Encoding'} = $c_enc;
  $self->{'headers'}{'X-Content-Charset'} = 'UTF-8';
  $self->{'body'} = \$value;
}

# ------------------------------------------------------------------------------
# format_json - Format the response in JSON.
# ------------------------------------------------------------------------------

sub format_json {
  my $self = shift;
  $self->{'headers'}{'Content-Type'} = 'application/json';
  $self->{'headers'}{'X-Content-Format'} = 'application/json';
  $self->{'headers'}{'X-Content-Charset'} = 'UTF-8';
  my $value = js_format({
    head => $self->{'head'},
    body => $self->{'body'},
  });
  $self->{'body'} = \$value;
}

# ------------------------------------------------------------------------------
# format_json_compat - (DEPRICATED) Format the response as an LSN JSON object.
# This method creates objects for use with the archaic /res/js/lsn.js library.
# ------------------------------------------------------------------------------

sub format_json_compat {
  my $self = shift;
  $self->{'headers'}{'Content-Type'} = 'text/json-hash'; # Needed for older livesite.js
  my $value = js_format_lsn(Data::OrderedHash->new(
    head => $self->{'head'},
    body => $self->{'body'},
  ));
  $self->{'body'} = \$value;
}

# ------------------------------------------------------------------------------
# DESTROY - Detach ourselves from the file-system access log
# ------------------------------------------------------------------------------

sub DESTROY {
  my $self = shift or throw Error::Programatic;
  $self->{fs_access_log} and
    $Hub->fs_access_log->remove_listener($self->{fs_access_log});
  $self->{fs_change_log} and
    $Hub->fs_change_log->remove_listener($self->{fs_change_log});
}

1;

__END__

=pod:summary HTTP Response Hash

=pod:synopsis

=pod:description

=pod:changes

  VERSION 0.2 on 2013-01-23 (Ryan)
  Added X-Accept header need for current AngularJS as all its request pass
  application/json as the first Accept header field, however the framework
  expects a text/html response.

=cut

  my $req_ct = $Hub->get('/sys/request/xargs/X-Response-Type');
  my $resp_ct = $self->{'headers'}{'Content-Type'};
  if ($req_ct && $resp_ct && $req_ct ne $resp_ct) {
    # The requestor has asked for the response to formatted differently
    # than the response has indicated it should be.  The requestor always
    # wins.
    $self->format_body_as($req_ct);
    $self->{'headers'}{'Content-Type'} = $req_ct;
  } elsif ($resp_ct) {
    # The response has indicated how it should be formatted by providing a
    # Content-Type header.
    $self->format_body_as($resp_ct);
  } else {
    # Glean the content type from the file extension
    my $ct = 'text/' . path_ext($self->{'addr'});
    $self->format_body_as($ct);
    $self->{'headers'}{'Content-Type'} = $ct;
  }
