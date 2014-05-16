package WWW::Livesite::Apache2;
use strict;
our $VERSION = 0;

# mod_perl
use Apache2::Const -compile => qw(:common :http M_GET M_POST);
use Apache2::Connection ();
use Apache2::ServerRec ();
use Apache2::ServerUtil ();
use Apache2::Access ();
use Apache2::Module ();
use Apache2::RequestRec ();
use Apache2::RequestIO ();
use Apache2::RequestUtil ();
use Apache2::SubRequest ();
use Apache2::URI ();
use Apache2::Directive;
use Apache2::Response;
use ModPerl::Util;
use APR::Finfo;
use APR::Const -compile => qw(:filetype FINFO_NORM);
use APR::URI;

# libapreq2
use Apache2::Request;
use Apache2::Upload;
use Apache2::Cookie;
use Apache2::Filter;

# CGI
use CGI::Cookie;

# livesite
use Perl::Module;
use Apache2::LogUtil;
use Data::OrderedHash;
use Data::Hub::Util qw(FS path_name);
use WWW::Livesite::Args;
use WWW::Livesite::Parameters;
use WWW::Livesite::Main;
use WWW::Livesite::Session;
use WWW::Livesite::Response;

# error handling
use Error qw(:try);
use Error::Simple;
use Error::Programatic;
use Error::Logical;

# miscellaneous
use Encode;
use JSON::XS;

our %Registry = (); # One Livesite Web Server per VirtualHost per Port
our $Main = undef; # The currently running Livesite Web Server instance
our $Stopwatch = Misc::Stopwatch->new; # For performance timing
our $Log = Apache2::LogUtil->new($Stopwatch); # Formatted apache log messages

# ==============================================================================
# bootstrap - Insert hooks into the current request cycle.
#
# This is a all-in-one easy configuration handler.  To use it:
#
#   PerlTransHandler +WWW::Livesite::Apache2->bootstrap
#
# and all of the other handlers will be added for you.  This ease of
# configuration comes at a cost, that is, each request goes through our handler 
# stack. Additionally, I have seen segmentation faults when trying to add the 
# cleanup handler on older mod_perl2 installations.
# ==============================================================================

sub bootstrap {

  my $r = ref($_[0]) ? $_[0] : $_[1];
  $Stopwatch->reset->start() if $r->is_initial_req;
  _handler_args($r);

  # The request cycle encompasses child requests as well.
  if ($r->is_initial_req) {
    _new_request_cycle($r);
    $r->push_handlers(PerlHeaderParserHandler => \&_header_parser_handler);
  } else {
    $Main->subrequest;
  }

  # The response handler is not invoked until _enable_response_hook is called.
  $r->push_handlers(PerlCleanupHandler => \&_cleanup_handler);
  $r->push_handlers(PerlMapToStorageHandler => \&_map_to_storage_handler);
  $r->push_handlers(PerlFixupHandler => \&_fixup_handler);

  # Allow subsequent trans handlers to run
  return Apache2::Const::DECLINED;

}

# ==============================================================================
# _map_to_storage_handler - Associate URI's which indicate mounted resources.
#
# Mount points act much like the Alias directive.
# ==============================================================================

sub _map_to_storage_handler {

  my $r = _handler_args(@_);

  # Forbidden URIs are set in /conf/handlers/access/forbidden
  return Apache2::Const::FORBIDDEN if $Main->is_forbidden($r->uri);
  return Apache2::Const::DECLINED if $Main->is_ignored($r->uri);

  if (my $node = $Main->get_fs_node($r->uri)) {

    if (isa($node, FS('File'))) {

      # A proper node will be returned even when the uri has erroneous slashes
      # due to how directories are indicated:
      #
      #   /index.html/
      #   /index.html///
      #
      return Apache2::Const::NOT_FOUND unless $r->uri eq $node->get_addr;

      # The requested URI maps to a valid node
      $Log->debug(sprintf('TRACE: Mapped %s to %s', $r->uri, $node->get_path));
      _set_finfo($r, $node->get_path);
      return Apache2::Const::OK;

    }

  }

  return Apache2::Const::DECLINED;

}

# ==============================================================================
# _header_parser_handler - Populate the system table with request information.
# ==============================================================================

sub _header_parser_handler {

  my $r = _handler_args(@_);

  # Parse query-string args into a case-insensitive multiset
  my $args = WWW::Livesite::Args->new($r->args);

  # Scheme and Hostname information of the request URI
  my $req_uri = APR::URI->parse($r->pool, $r->construct_url);

  # Standard request variables
  my $sys_req = $Main->{sys}{request};
  $sys_req->{headers} = $r->headers_in;
  $sys_req->{qs} = $args;
  $sys_req->{hostname} = $req_uri->hostname;  # example.com
  $sys_req->{method} = $r->method;            # GET|POST|...

  # URI Scheme (http|https)
  my $ssl_config = $Main->{sys}->get('conf/modules/ssl') || {};
  if ($$ssl_config{'trust_uri_scheme_header'}) {
    my $k = $$ssl_config{'uri_scheme_header_name'} || 'X-URI-Scheme';
    my $v = $sys_req->{'headers'}{$k};
    $sys_req->{scheme} = $v || $req_uri->scheme;
  } else {
    $sys_req->{scheme} = $req_uri->scheme;
  }

  # Parse cookies (See cgi-cookie-notes at EOF)
  my $cookies = CGI::Cookie->fetch($r);
  $sys_req->{cookies} = $cookies;

  # Initialize session
  my $sid_key = $Main->{sys}{sid_key} = _gen_sid_key($r, $req_uri);
  my $sid = $cookies->{$sid_key} ? $cookies->{$sid_key}->value : undef;
  my $sid_keysrc = $Main->{sys}{sid_keysrc};
  $Log->debug('SESSION: SID (from cookie): ', $sid, " key=${sid_key} [${sid_keysrc}]");
  my $session = $Main->{sys}{session} = WWW::Livesite::Session->new($sid);
  $session->authenticate();

  return Apache2::Const::DECLINED;

}

# ==============================================================================
# _fixup_handler - Enable the responder if the request is authorized. 
# ==============================================================================

sub _fixup_handler {

  my $r = _handler_args(@_);
  my $req = $Main->{sys}{request};
  my $node = $Main->get_fs_node;
  my $uri = $r->uri; # not always a node, includes trailing slash

  # The uri for sub-requests is not known until this point
  $req->set_uri($uri);

  # The optional responder determines escalated permission and whether or not
  # there is anything to do during the response phase.
  my $rr = $Main->get_responder($uri);

  # Redirect to the login page unless the visitor has permission to access
  # this resource.
  my $mode = $rr ? $rr->get_permission_mode : 'r';
  return _redir_auth_required($r, "mode=$mode") unless $Main->is_authorized($uri, $mode);

  # The X-Auth parameter of 'disabled' is used to complete a request for an 
  # authorized user as if they were not authorized.
  my $xauth = $req->{'xargs'}{'X-Auth'};
  $Main->{'sys'}{'user'} = $xauth && $xauth eq 'disable'
    ? undef
    : $Main->{'sys'}{'session'}->get_user();

  # We have an issue with disabling mod_dir in Apache 2.4 and later.
  # http://mail-archives.apache.org/mod_mbox/perl-modperl/201404.mbox/%3C5348FB64.6010008%40livesite.net%3E
  # So, directory handlers (in order to trump mod_dir/mod_autoindex) are invoked here.
  if ($rr && isa($node, FS('Directory'))) {
    my $status = _response_handler($r);
    return $status == Apache2::Const::OK
      ? Apache2::Const::DONE
      : $status;
  }

  # If a prior request has been cached and it is still valid, respond 
  # accordingly.
  if (my $mtime = $Main->get_cache_mtime) {
    $Log->debug('CACHE: ', $mtime, ' <= ', $req->get_mtime);
    if ($mtime <= $req->get_mtime) {
      # The response can be sent at this time because there is no need to send 
      # an entity body.
      my $rtag = $Main->{'sys'}{'request'}->get_rtag;
      my $etag = $Main->{'cache'}{'meta'}{'etag'};
      $Main->{'sys'}{'response'}{'etag'} = $etag;
      my $msg = 'CACHE: Not modified: rtag=%s; etag=%s, uri=%s';
      $Log->debug(sprintf($msg, $rtag, $etag, $uri));
      return _send_response($r, Apache2::Const::HTTP_NOT_MODIFIED);
    } else {
      # The response phase is now used to write the cached entity body to
      # the client.
      _enable_cached_response_hook($r);
      return Apache2::Const::OK;
    }
  }

  # Set response headers if the requestor has asked that the response be an 
  # attachment.
  if (my $xdisp = $req->{'xargs'}{'X-Return-Disposition'}) {
    if ($xdisp eq 'attachment') {
      my $fn = path_name($uri);
      $fn =~ s/"/\\"/g;
      my $cdisp = sprintf 'attachment; filename="%s"', $fn;
      my $cc = 'no-cache, no-store, max-age=0';
      if ($rr) {
        # Respone headers MUST be added this way when response caching is in
        # effect.  (Otherwise the cached metadata will not contain these 
        # headers.)
        my $resp = $Main->{sys}{response};
        $resp->{headers}{'Content-Disposition'} = $cdisp;
        $resp->{headers}{'Cache-Control'} = $cc;
      } else {
        $r->headers_out->add('Content-Disposition' => $cdisp);
        $r->headers_out->add('Cache-Control' => $cc);
      }
    }
  }

  # Set response headers if the requestor has asked that the response be 
  # returned as a specific type.  Only do this for 'text/' types.  The 
  # motivation is to have a normly HTML response come back as 'text/plain',
  # such that it will display nicely as the src parameter for an iframe.
  #
  # Without the 'text/' restriction, then some one could craft some kind of
  # injection that would not be caught by normal filters, which would attack
  # the browsers renderer, e.g., 'application/vulnerable-app'

  if (my $xct = $req->{'xargs'}{'X-Response-Type'}) {
    if ($xct eq 'text/plain') {
      # just allow text/plain for now, can add more
      $r->content_type($xct);
      $Main->{'sys'}{'response'}{'user_content_type'} = $xct;
    }
  }

  # This is the end of the cycle (other than cleanup) when there is no 
  # responder.  We do not forbid access to PerlModule files until this point
  # as there are responders which will return this content (for admins).
  unless ($rr) {
    return Apache2::Const::FORBIDDEN if isa($Main->{'node'}, FS('PerlModule'));
    return Apache2::Const::DECLINED;
  }

  # Prepare for the response phase
  _enable_response_hook($r);
  return Apache2::Const::OK;

}

# ==============================================================================
# _cached_response_handler - Send the pre-compiled content to the client.
# ==============================================================================

sub _cached_response_handler {
  my $r = _handler_args(@_);
  if ($Main->get_cache->merge) {
    my $rtag = $Main->{'sys'}{'request'}->get_rtag;
    my $fn = $Main->{'sys'}{'response'}{'send_file'};
    my $msg = 'CACHE: Using pre-compiled content: rtag=%s; path=%s';
    $Log->info(sprintf($msg, $rtag, $fn));
    return _send_response($r, Apache2::Const::OK);
  }
  return _response_handler(@_);
}

# ==============================================================================
# _response_handler - Invoke the responder.
# ==============================================================================

sub _response_handler {
  my $r = _handler_args(@_);
  my $uri = $Main->{sys}{request}{uri} or die 'URI not set';
  my $rr = $Main->get_responder or die 'No responder';
  my $resp = $Main->{sys}{response};
  my $cgi_data = {};

  $Log->debug("TRACE: Using responder: $rr");

  # If this is a POST request, and the responder wants to honor posted data,
  # then parse the request body.
  my $len = $r->headers_in->{'Content-Length'} || 0;
  if ($len && $r->method_number() == Apache2::Const::M_POST && $rr->can_post
      && !$rr->can_upload) {

    $Log->debug("TRACE: Parse Request Body");

    # A non-true value for max_post_size indicates there are no restrictions.
    # Which is a little dangerous considering we are reading the post into a
    # scalar.
    if (my $max = $rr->max_post_size) {
      throw Error::Simple "Max POST size exceded: $max" if $len > $max;
    }

    # The Content-Type and X-Content-Format requrest headers indicate how the 
    # POST body is formatted. Recognized values are:
    #
    #   application/json    JSON data format
    #   text/json-hash      JSON data format
    #   text/data-xfr       Livesite XFR format
    my $sys_req = $Main->{sys}{request};
    my $xfmt = lc($sys_req->{xargs}{'X-Content-Format'} || '');
    my $ct = lc($sys_req->{headers}{'Content-Type'} || '');

    if ($xfmt || $ct eq 'application/json') {

      $Log->debug("TRACE: reading request body");

      # Read the request body (this will invoke input filters).
      my $body = '';
      $r->read($body, $len);

      # Parse the body string according to its format
      if ($xfmt eq 'text/json-hash'
          || $xfmt =~ '^(text|application)/json$'
          || $ct =~ '^(text|application)/json$') {

        $Log->debug("READ: Parsing JSON");
        $body = Apache2::URI::unescape_url($body);
        $cgi_data = decode_json($body);

      } elsif ($xfmt eq 'text/data-xfr') {

        $Log->debug("READ: Parsing XFR");
        my $xenc = $Main->{sys}{request}{xargs}{'X-Content-Encoding'};
        my $xfr = Data::Format::XFR->new($xenc);
        my $data = $xfr->parse($body);
        if (isa($data, 'ARRAY')) {
          # Parameters must be in HASH form
          $cgi_data = Data::OrderedHash->new();
          my $i = 0;
          for (@$data) {
            $cgi_data->{$i++} = $_;
          }
        } elsif (isa($data, 'HASH')) {
          $cgi_data = $data;
        } else {
          $Log->error('POST data is not a HASH or ARRAY');
        }

      } else {

        $Log->warn("READ: Discarded request body (was read but not parsed)");

      }

    } else {

      $Log->debug('TRACE: Using req params');

      # Punt to Apache2::Request to do the work
      $cgi_data = sub {
        return $Main->{sys}{request}{obj}->param() || {};
      };

    }

  } else {

    # This is a GET request
    #   or an upload
    #   or the responder does not honor POST data.
    #
    # For file uploads, we do NOT want /sys/request/cgi to come from the
    # request object, because doing so will cause the body to be read, input
    # filters to run, etc.
    $cgi_data = $Main->{sys}{request}{qs};

  }

  $Main->{sys}{request}{cgi} = WWW::Livesite::Parameters->new($cgi_data);

  # The response object is populated before the output is written to the 
  # network.  As soon as it is started, all access to the file-system is 
  # tracked and used later by the caching mechanism to determine dependencies.
  $Log->debug("TRACE: Start response");
  $resp->start($rr);

  my $status = try {

    # The responder compiles its data
    $Log->debug("TRACE: Compile response");
    $rr->compile;
    return Apache2::Const::OK;

  } catch Error::HttpsRequired with {

    my $uri = $Main->{sys}{request}{page}{full_uri};
    my $qs = $Main->{sys}{request}{qs}->as_string;
    $$resp{headers}{Location} = $qs
      ? sprintf('https:%s?%s', $uri, $qs)
      : sprintf('https:%s', $uri);
    $Log->warn("Switching schemes, http -> https");

  } catch Error::HttpsNotRequired with {

    my $uri = $Main->{sys}{request}{page}{full_uri};
    my $qs = $Main->{sys}{request}{qs}->as_string;
    $$resp{headers}{Location} = $qs
      ? sprintf('http:%s?%s', $uri, $qs)
      : sprintf('http:%s', $uri);
    $Log->warn("Switching schemes, https -> http");

  } catch Error::DoesNotExist with {

    # Easily send a 404 by throwing this exception
    my $ex = shift;
    $Log->debug('TRACE: ', $ex);
    return Apache2::Const::NOT_FOUND;

  } catch Error::AccessDenied with {

    # Easily punt to 401 (auth required) by throwing this exception
    my $ex = shift;
    return _redir_auth_required($r, $ex);

  } catch Error::Logical with {

    # Something the client sent didn't make sense
    my $ex = shift;
    $Log->error($ex);
    return _client_error($r, $ex->message());

  } catch Error::Programatic with {

    # Something in the programming is off
    my $ex = shift;
    $Log->error($ex);
    return _server_error($r, $ex->message());

  } catch Error with {

    # We don't want the file/line-no sent back to the client, hence the direct
    # access to the '-text' member (See C<Error>).
    my $ex = shift;
    $Log->error($ex);
    return _server_error($r, $ex->{'-text'});

  } otherwise {

    # Just a plain old error like die, confess, etc.
    $Log->error($@);
    return _server_error($r, $@);

  };

  # Stop tracking file-system access
  $resp->stop;

  # This handler returns the same status as the the document
  return _send_response($r, $status);
};

# ------------------------------------------------------------------------------
# _send_response - The request is complete, send headers and content.
# ------------------------------------------------------------------------------

sub _send_response {
  my $r = shift;
  my $status = shift;
  my $resp = $Main->{sys}{response};

  if (my $new_uri = $resp->{'internal_redirect'}) {
    $Log->debug('TRACE: ', "Internal Redirect: $new_uri");
    $r->internal_redirect($new_uri);
    return Apache2::Const::OK;
  }

  # Content-Length is set here; however not for
  # - send_file (because Apache does this), nor for
  # - standalone (because standalone implies we should not interfere).
  my $content = str_ref($resp->{'body'});
  if ($status == Apache2::Const::OK
      && !$resp->{'send_file'}
      && !$resp->{'standalone'}
      && ref($content)
      && $$content) {
    my $content_length = 0;
    {
      use bytes;
      $content_length = length($$content);
      no bytes;
    }
    if ($content_length > 0) {
      $resp->{'headers'}{'Content-Length'} = [$content_length];
    }
  }

  # Send the HTTP headers to the client.  The headers are parsed and the status
  # is updated accordingly.
  $status = _send_headers($r, $status);

  # Response content
  if ($status == Apache2::Const::OK) {

    if (my $path = $resp->str('send_file')) {

      # Direct send
      $r->sendfile($path);

    } elsif ($resp->{'standalone'}) {

      # Stand-alone means we do not send output to the client (as whomever set
      # this semiphore is writing to stdout).

    } else {

      # The content is final, send to client
      if (ref($content) && $$content) {
        binmode STDOUT if $$resp{'binmode'};
        $r->print($$content);
      }

    }

  }

  # Write a record to the log file which indicates how this request was 
  # completed.
  $Log->debug(sprintf('PERF: %s %s %s', $r->method,
    ($status == 0 ? 200 : $status),
    $r->uri
  ));

  # Mark the response and return Apache2::Const HTTP status code
  $resp->{have_sent_body} = 1;
  $status;
}

# ------------------------------------------------------------------------------
# _send_headers - Send HTTP headers
# ------------------------------------------------------------------------------

sub _send_headers {
  my $r = shift;
  my $status = shift;
  my $resp = $Main->{sys}{response};

  # Only send headers once.
  return $resp->{status} if $resp->{have_sent_headers};

  # Output Session ID on each request, with the updated expiration.
  if (my $sid_key = $Main->{sys}{sid_key}) {
    my $valid_sid = $Main->{sys}->get('session/SID');
    my $timeout = $Main->{sys}{session}->get_timeout;
    $resp->{'cookies'}{$sid_key} = {
      -expires => $timeout,
      -value => $valid_sid,
    };
  }

  # Turn cookie stub-objects into cookie strings as headers
  foreach my $k (keys %{$resp->{'cookies'}}) {
    my $v = $resp->{'cookies'}{$k};
    my $cookie = Apache2::Cookie->new($r,
      -name => $k,
      -path => '/',
      ref($v) ? %$v : (-value => $v),
    );
    my $str = $cookie->as_string . '; HttpOnly';
    $resp->{'headers'}{'Set-Cookie'} = $str;
  }

  # Adde entity tag
  my $etag = $resp->{'headers'}{'ETag'} ||= $resp->get_etag;
  $Log->debug('CACHE: ', "ETag=$etag");

  # Any end-to-end headers provided in the 304 or 206 response MUST replace the 
  # corresponding headers from the cache entry (HTTP spec section 13.5.3).
  # We need to ensure cached responses (on the client) are re-validated.
  my $cc = $resp->{'headers'}{'Cache-Control'};
  $resp->{'headers'}{'Cache-Control'} = ["must-revalidate"] unless ($cc);

  # Add all HTTP headers to the Apache2 response
  if (my $ct = $resp->{'user_content_type'}) {
    $resp->{'headers'}{'Content-Type'} = $ct;
  }
  foreach my $header ($resp->{'headers'}->as_array) {
    if ($header->[0] eq 'Content-Type') {
      $r->content_type($header->[1]);
      next; # do not add this to the table
    }
    if ($header->[0] eq 'Content-Length') {
      # This also prevents Apache from using chunked transfer encoding.
      $r->set_content_length($header->[1]);
      next; # do not add this to the table
    }
    $r->err_headers_out->add(@$header);
    $status = Apache2::Const::REDIRECT if $header->[0] eq 'Location';
    $status = $header->[1] if $header->[0] eq 'Status';
  }

  # HTTP/1.1 servers SHOULD send Last-Modified whenever feasible.
  $r->set_last_modified($$resp{'mtime'} || time);

  # Mark the response and return the status
  $resp->{have_sent_headers} = 1;
  $resp->{status} = $status;
}

# ==============================================================================
# _cleanup_handler - Unintialize application variables.
# ==============================================================================

sub _cleanup_handler {

  my $r = _handler_args(@_);

  # When using Apache2::Reload I have have had processes which will not reload
  # the module after it has compile errors (even if they have since been 
  # fixed), resulting in a defunct worker process.  This is an aggressive 
  # technique to weed out such processes.
  if ($r->status >= 500 &&
      $Main->{'sys'}->get('conf/debug/terminate_on_error')) {
    $Log->warn('Terminating child due to server errors.');
    $r->child_terminate;
  }

  # Update cache information
  _save_cache_info($r) if $Main->get_responder;

  # Track changes
  _save_change_log();

  # Write a record to /tmp/debug/req_hist.hf for debugging (if enabled)
  _save_debug_info($r);

  return Apache2::Const::OK;
}

# ------------------------------------------------------------------------------
# _save_cache_info - Update an existing cached object.
# ------------------------------------------------------------------------------

sub _save_cache_info {
  my $r = _handler_args(@_);
  my $resp = $Main->{'sys'}{'response'};
  if ($$resp{'have_sent_body'} && !$resp->{'have_cached'}) {
    my $status = $$resp{'status'};
    if ($status == Apache2::Const::HTTP_NOT_MODIFIED) {
      $Log->debug('CACHE: update');
      $Main->update_cache;
    } elsif ($status == Apache2::Const::OK) {
      $Log->debug('CACHE: store');
      $Main->store_response;
    } else {
      $Log->debug('CACHE: purge');
      $Main->purge_cache;
    }
    $resp->{'have_cached'} = 1; # Signal to parent request
  }
  return Apache2::Const::OK;
}

sub _save_change_log {
  $Log->debug('CHANGES: saving change log');
  my $resp = $Main->{'sys'}{'response'} or return;
  my $fs_change_log = $$resp{'fs_change_log'} or return;
  my $logfile = $Main->{sys}{tmp}->vivify('changelog.yml');
  my $entries = $$logfile{'entries'} ||= {};
  my $u = $Main->{'sys'}{'user'};
  my $un = $u ? $u->get_username : 'guest';
  $Log->debug("CHANGES: user is `$un`");
  foreach my $path ($fs_change_log->keys) {
    $Log->debug("CHANGES: $path");
    $entries->{$path} = $un;
  }
  $logfile->save();
}

# ------------------------------------------------------------------------------
# _handler_args - This is the first thing that happens in each handler
# ------------------------------------------------------------------------------

sub _handler_args {
  my $r = ref($_[0]) ? $_[0] : $_[1];
  # Setting the request object directs output to the VirtualHost error log.
  $Log->set_request($r);
  $Log->debug(sprintf('HANDLER: %s for %s', ModPerl::Util::current_callback(), $r->uri));
  wantarray ? ($r, $Main) : $r;
}

# ------------------------------------------------------------------------------
# _new_request_cycle - Initialize application
# _new_request_cycle $r
#
# This method will set this package's $Main variable which is valid for the
# current request and its subrequests.
#
# We will extend $Main with this information:
#
#   /sys/log
#   /sys/stopwatch
#   /sys/server/uri
#   /sys/server/name
#   /sys/server/port
#
# TODO
#
#   /sys/server/home
#   /sys/server/document_root (maybe /sys/vhost/document_root)
# ------------------------------------------------------------------------------

sub _new_request_cycle {

  my $r = shift or die 'No request record';
  my $s = $r->server or die 'No server record';
  my $doc_root = $r->document_root or die 'No document root';
  my $port = $s->port() || 80;
  my $inst_key = join(':', $s->server_hostname(), $port, $doc_root);

  if ($Main = $Registry{$inst_key}) {

    # This will bump the file-system watermark and invoke any necessary
    # initialization code.
    $Main->recycle();

  } else {

    $Log->debug('TRACE: ', 'Create new application');

    # Create the new application
    $Registry{$inst_key} = $Main = WWW::Livesite::Main->new($doc_root);

    # Populate information which does not change each request
    $Main->{sys}{log} = $Log;
    $Main->{sys}{stopwatch} = $Stopwatch;
    my $server_uri = '//' . $s->server_hostname();
    $server_uri .= ':' . $port if $port ne '80';
    $Main->{sys}{server} = {
      'uri' => $server_uri,
      'name' => $s->server_hostname(),
      'port' => $port,
      'config' => {},
    };
  
    # Glean information from the Apache configuration
    my $tree = Apache2::Directive::conftree();
    my @nodes = $tree->lookup('DirectoryIndex')
      or $Log->warn('No DirectoryIndex found');
    my @indexes = ();
    for (@nodes) {
      next if ref;
      push @indexes, split /\s/;
    }
    $Log->debug('DirectoryIndex: ', @indexes);
    $Main->{sys}{server}{config}{indexes} = \@indexes;

    # Find Livesite configuration files specified in the Apache configuration,
    # and append them in proper overlay order.
    my @config_files = ();
    for (my $i = 1; $i < 10; $i++) {
      my $path = $r->dir_config("Livesite_Config$i");
      last unless $path;
      die "$!: $path (Livesite_Config$i)" unless -e $path;
      push @config_files, $path;
    }
    if (my $path = $r->dir_config('Livesite_Config')) { # (has prescedence)
      die "$!: $path (Livesite_Config)" unless -e $path;
      push @config_files, $path;
    }

    # Load configuration files and initialize accordingly.
    $Main->load_config_files(@config_files);

  }

  $Main;
}

# ------------------------------------------------------------------------------
# _set_finfo - Associate a physical file path with the current request.
# _set_finfo $path
# ------------------------------------------------------------------------------

sub _set_finfo {
  my $r = shift or return;
  my $path = shift or return;
  $r->filename($path);
  $r->finfo(APR::Finfo::stat($path, APR::Const::FINFO_NORM, $r->pool));
}

# ------------------------------------------------------------------------------
# _enable_response_hook - Enable the response phase handler.
# _enable_response_hook $r
# ------------------------------------------------------------------------------

sub _enable_response_hook {
  my $r = shift;
  $Log->debug('TRACE: ', 'Enable response hook');
  $r->push_handlers(PerlResponseHandler => \&_response_handler);
  $r->handler('modperl');

  # Create the libapreq2 Request object which supports uploads and parses CGI
  # parameters from the request body. We do not read cgi parameters until this 
  # point, as doing so will invoke  input filters.
  my $rr = $Main->get_responder or die 'No responder';
  my $req = $Main->{sys}{request}{obj} = Apache2::Request->new(
    $r,

#   Allow uploads for all responders as the template may do the work
#   DISABLE_UPLOADS => $rr->can_upload ? 0 : 1,

# Defining the temp directory here yields an error when it is already defined
# in the Apache configuration.
#   TEMP_DIR => $Main->{sys}{conf}{sys_tmp_dir},

  );

  # The Apache request library only allows lowering the read limit (POST_MAX).
  # The default is 64M (64 * 1024 * 1024) so if larger uploads are desired, one
  # must raise the limit by setting APREQ2_ReadLimit in the Apache configuration.
  # When using VirtualHosts, the larger limit *must* be specified in server 
  # configuration, and then optionally reduced in the vhost config.
  # http://marc.info/?l=apreq-dev&m=115829354028472&w=2
  my $limit = $req->read_limit();
  my $max = $rr->max_post_size;
  if ($max > $limit) {
    $Log->warn(sprintf('Cannot raise read_limit from %d to %d', $limit, $max));
  } else {
    $req->read_limit($max) or die $!;
    $limit = $req->read_limit();
    $Log->error('Error setting read_limit') unless $limit == $max;
  }

  if (my $rif = $rr->get_input_filter) {
    $Log->debug('TRACE: ', 'Adding input filter: $rif');
    $r->add_input_filter($rif);
  }
}

# ------------------------------------------------------------------------------
# _enable_cached_response_hook - Enable the response phase handler.
# _enable_cached_response_hook $r
# ------------------------------------------------------------------------------

sub _enable_cached_response_hook {
  my $r = shift;
  $r->push_handlers(PerlResponseHandler => \&_cached_response_handler);
  $r->handler('modperl');
}

# ------------------------------------------------------------------------------
# _gen_sid_key - Generate the Session ID Cookie key
# _gen_sid_key $r
#
# The cookie header may contain multiple values for the same key (session id), 
# as they were harvested from multiple domains.  For example, if the session id
# is C<SID>:
#
#   example.com       SID=12345
#   ie.example.com    SID=67890
#
# which will produce a C<Cookie>header of:
#
#   SID=12345; SID=67890
#
# which is sent to C<ie.example.com>.  As per the spec, the *first* occurance 
# takes precedence.  To ensure we always use the logically correct cookie, we 
# create a the session id key based on the this server's uri.
#
# Additionally, we use identifying client headers in the calculation.  Although 
# they are not reliable, the X-Forwarded-For and Referer headers provide some 
# uniqueness for isolating sessions and thus making CSRF attacks more difficult 
# to craft.
#
# Also the scheme, e.g, http vs https, is used unless the configuration
# indicates C<session/share_http_schemes>.
#
# An empty referrer is treated the same as requests referred from the same 
# domain.  This is the case when accessing a resource directly.  If one can
# craft a request with an empty referrer, then they surely can set it to
# the same domain.
#
# TODO Move this code to the WWW::Livesite:: name space (so it may be re-used
# by FastCGI, etc)
# ------------------------------------------------------------------------------

sub _gen_sid_key {
  my $r = shift;
  my $req_uri = shift;
  my @origins = ();
  if (my $xff = $r->headers_in->{'X-Forwarded-For'}) {
    for (split /,/, $xff) {
      my $uri = APR::URI->parse($r->pool, $_);
      push @origins, $uri->hostname;
    }
  }
  if (my $referer = $r->headers_in->{'Referer'}) {
    my $uri = APR::URI->parse($r->pool, $referer);
    if ($uri->hostname != $req_uri->hostname) {
      push @origins, $uri->hostname;
    }
  }
  my @sources = ();
  push @sources, $req_uri->scheme
    unless $Main->get_config('/session/share_http_schemes');
  push @sources, $req_uri->hostname;
  my $sid_keysrc = $Main->{sys}{sid_keysrc} = join(';', @sources, @origins);
  'v01' . checksum($sid_keysrc);
}

# ------------------------------------------------------------------------------
# _redir - Complete the request, redirecting as specified
# ------------------------------------------------------------------------------

sub _redir {
  my $r = shift;
  my $uri = shift or die;
  $Main->{sys}{response}{headers}{'Location'} = $uri ;
  return _send_headers($r, Apache2::Const::REDIRECT);
}

# ------------------------------------------------------------------------------
# _redir_auth_required - Complete the request, redirecting to the login page.
# ------------------------------------------------------------------------------

sub _redir_auth_required {
  my $r = shift;
  my $info = shift;
  my $user = $Main->{sys}{session}->get_user();
  my $un = $user ? $user->get_username : '';
  my $g = $user ? $user->get_groups : '';
  my $resp = $Main->{sys}{response};
  my $msg = sprintf('AUTH: Access denied: un=%s; g=%s; res=%s', $un, $g, $r->uri);
  $info and $msg .= "; $info";
  $Log->warn($msg);
  # The login page is the body for unauthorized requests.  In our case it 
  # contains a login dialog box for both page and XHR requests.
  my $login_page = $Main->get_config('/handlers/auth/login_page')
    || '/res/login/index.html';
  $r->add_config(["ErrorDocument 401 $login_page"]);
  $r->err_headers_out->add('WWW-Authenticate' => 'Web');
  return Apache2::Const::AUTH_REQUIRED;
}

# ------------------------------------------------------------------------------
# _client_error - Set the status and log according to a client error
# ------------------------------------------------------------------------------

sub _client_error {
  my $r = shift;
  my $msg = shift || 'Conflict';
  $msg =~ s/(?<!\\)"/\\"/g;
  $r->add_config(["ErrorDocument 409 \"$msg\""]);
  Apache2::Const::HTTP_CONFLICT;
}

# ------------------------------------------------------------------------------
# _server_error - Set the status and log according to a server error
# ------------------------------------------------------------------------------

sub _server_error {
  my $r = shift;
  my $msg = shift || 'Internal Server Error';
  $msg =~ s/(?<!\\)"/\\"/g;
  $r->add_config(["ErrorDocument 500 \"$msg\""]);
  Apache2::Const::SERVER_ERROR;
}

# ------------------------------------------------------------------------------
# _save_debug_info - 
# ------------------------------------------------------------------------------

sub _save_debug_info {

  my $r = shift;
  my $sys = $Main->{sys};
  my $tmp = $Main->{sys}{tmp};
  if (my $req_hist_size = $sys->get('conf/debug/req_hist_size')) {
    throw Error::Programatic "'req_hist_size' must be numeric\n"
      unless is_numeric($req_hist_size);

    my $hf = $tmp->vivify('debug/req_hist.hf');
    my $reqs = $hf->{'request'} ||= [];
    my $rr = $Main->get_responder;
    unshift @$reqs, Data::OrderedHash->new(
      responder => $rr ? ref($rr) : '(none)',
      method => $r->method,
      uri => $r->uri,
      unparsed_uri => $r->unparsed_uri,
      qs => $sys->{request}{qs},
      headers => $sys->{request}{headers},
      xargs => $sys->{request}{xargs},
      cgi => $sys->{request}{cgi},
      response => {
        content_type => $r->content_type,
        status => $r->status_line,
        headers => $sys->{response}{headers},
      },
    );
    @$reqs > $req_hist_size and splice @$reqs, $req_hist_size;
    $hf->save();
  }

}

1;

__END__
