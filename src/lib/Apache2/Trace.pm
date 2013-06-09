package Apache2::Trace;
use strict;
use Apache2::ServerRec ();
use Apache2::RequestRec ();
use Apache2::Const -compile => qw(DECLINED OK);
use Apache2::LogUtil;
use Misc::Stopwatch;

our $Stopwatch = Misc::Stopwatch->new; # For performance timing
our $Log = Apache2::LogUtil->new($Stopwatch); # Formatted apache log messages

our @Server_Phases = qw(
  PerlOpenLogsHandler
  PerlPostConfigHandler
  PerlChildInitHandler
  PerlChildExitHandler
);

our @Request_Phases = qw(
  PerlPostReadRequestHandler
  PerlTransHandler
  PerlMapToStorageHandler
  PerlHeaderParserHandler
  PerlAccessHandler
  PerlAuthenHandler
  PerlAuthzHandler
  PerlTypeHandler
  PerlFixupHandler
  PerlResponseHandler
  PerlLogHandler
  PerlCleanupHandler
);

# ------------------------------------------------------------------------------
# server_phases - Adds a handler to each Server Cycle Phase
# ------------------------------------------------------------------------------

sub server_phases {
  my ($pkg_name, $conf_pool, $log_pool, $temp_pool, $s) = @_;
  $Stopwatch->reset->start();
  $Log->set_request();
  _add_server_phase_tracers($s);
  Apache2::Const::OK;
}

# ------------------------------------------------------------------------------
# _add_server_phase_tracers - Adds a handler to each HTTP Request Cycle Phase
# ------------------------------------------------------------------------------

sub _add_server_phase_tracers {
  my $s = shift;
  for (@Server_Phases) {
    $s->push_handlers($_, sub {
      my $s = $_[3] || $_[1]; # OpenLogs and PostConfig are passed 4 while Init 
                              # and Exit are passed 2 args
      $Log->warn($s->server_hostname());
      return Apache2::Const::OK;
    });
  }
}

# ------------------------------------------------------------------------------
# http_phases - Adds a handler to each HTTP Request Cycle Phase
# ------------------------------------------------------------------------------

sub http_phases {
  my ($pkg_name, $r) = @_;
  $Stopwatch->reset->start();
  $Log->set_request($r);
  _add_http_phase_tracers($r);
  Apache2::Const::DECLINED;
}

# ------------------------------------------------------------------------------
# _add_http_phase_tracers - Adds a handler to each HTTP Request Cycle Phase
# ------------------------------------------------------------------------------

sub _add_http_phase_tracers {
  my $r = shift;
  for (@Request_Phases) {
    $r->push_handlers($_, sub($) {
      my $r = shift;
      my $msg = sprintf('status=%s, uri=%s, filename=%s',
        $r->status,
        $r->uri,
        $r->filename,
      );
      $Log->warn($msg);
      return Apache2::Const::DECLINED;
    });
  }
}

1;

__END__

=pod:summary Trace mod_perl server events

=pod:synopsis

In your Apache configuration file:

  PerlOpenLogsHandler +Apache2::Trace->server_phases
  PerlPostReadRequestHandler +Apache2::Trace->http_phases

  # Or to trace subrequests as well
  PerlTransHandler +Apache2::Trace->http_phases

Will add a tracer to each HTTP request-cycle phase.  Each tracer will produce a
warning-level message in the current request's error log:

  ... [warn] <PostReadRequest> [22933-0:0.0043] status=200, uri=/favicon.ico, filename=
  ... [warn] <MapToStorage> [22933-0:0.0125] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <HeaderParser> [22933-0:0.0196] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <Access> [22933-0:0.0200] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <Type> [22933-0:0.0200] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <Fixup> [22933-0:0.0208] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <Log> [22933-0:0.0212] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico
  ... [warn] <Cleanup> [22933-0:0.0229] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico

Which is formatted as:

   .----------------------------------------------------------------------- Apache date/time stamp
   |     .----------------------------------------------------------------- Logging level
   |     |      .---------------------------------------------------------- HTTP Request Cycle Phase
   |     |      |         .------------------------------------------------ Process ID
   |     |      |         |     .------------------------------------------ Thread ID (for threaded perl) or 0
   |     |      |         |     | .---------------------------------------- Elapsed time
   |     |      |         |     | |       .-------------------------------- Current status
   |     |      |         |     | |       |           .-------------------- Request URI
   |     |      |         |     | |       |           |                 .-- Mapped storage
   v     v      v         v     v v       v           v                 v
  [...] [warn] <Cleanup> [22933-0:0.0229] status=200, uri=/favicon.ico, filename=/var/www/example.com/htdocs/favicon.ico

=pod:see also

L<http://perl.apache.org/docs/2.0/user/handlers/http.html#HTTP_Request_Cycle_Phases>
L<Apache2::LogUtil>

=cut
