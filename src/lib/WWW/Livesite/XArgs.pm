package WWW::Livesite::XArgs;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Tie::Hash;
use Data::Hub::Container;
use WWW::Livesite::Headers;
our @ISA = qw(Tie::ExtraHash Data::Hub::Container);
our $VERSION = 0.3;

# Removed so they are not used in the rtag_str cache string
# 'X-Forwarded-For',        # Used when generating session id
# 'X-Content-Format',       # Indicates the format of the request body
# 'X-Content-Encoding',     # Indicates the encoding of the request body

# Found this to be commented out, not sure why.
# 'X-Branch',               # XCommand 'fetch' will return the entire branch

our @INTERNAL_NAMES = (
  'X-Command',              # Used to invoke the XCommand responder
  'X-Auth',                 # Used to generate an unauthorized response
  'X-Base-Uri',             # Merge with this base to produce absolute urls
  'X-Return-Disposition',   # Indicates the response should be returned as an attachment
  'X-Response-Type',        # Requests that output be formatted as type
  'X-Link-Origin',          # Either 'same-domain' or 'remote'
  'X-Accept',               # For those without access to modify the Accept header (AngularJS routes)
  'X-HTTP-Scheme',          # Set by the reverse proxy, 'http' or 'https'
);

sub new {
  my $pkg = ref($_[0]) ? ref(shift) : shift;
  my $self = bless {}, $pkg;
  tie %$self, $pkg;
  $self;
}

sub internal {
  my $self = shift;
  my $result = {};
  foreach my $name (@INTERNAL_NAMES) {
    next unless exists $$self{$name};
    $result->{$name} = $self->{$name};
  }
  $result;
}

sub TIEHASH  {
  my $pkg = shift;
  return bless [], $pkg;
}

sub __init {
  return $_[0][0] if defined($_[0][0]);
  my $h = WWW::Livesite::Headers->new(); # provides case-insenitive logic
  my $x_params = $Hub->get('/sys/request/qs|{?(=~):^[xX]-}');
  my $x_headers = $Hub->get('/sys/request/headers|{?(=~):^[xX]-}');
  $x_params and overlay($h, $x_params, -pure_perl);
  $x_headers and overlay($h, $x_headers, -pure_perl);
  $_[0][0] = $h;
}

sub FETCH {
  my $h = $_[0]->__init;
  $$h{$_[1]};
}

sub FIRSTKEY {
  my $h = $_[0]->__init;
  each %$h;
}

1;

__END__

=pod:summary Hash of 'X-' HTTP Headers and CGI parameters

=pod:synopsis

This hash is a composite of HTTP Headers and CGI parameters which begin with
C<X-> (case sensitive).  This pool is used by convention to indicate system
parameters, those which are used by the application to control the application.

The running instance of this hash is available at:

  /sys/request/xargs

=pod:description

  X-Forwarded-For         # Used when generating session id
  X-Content-Format        # Indicates the format of the request body
  X-Content-Encoding      # Indicates the encoding of the request body
  X-Command               # Used to invoke the XCommand responder
  X-Auth                  # Used to generate an unauthorized response
  X-Accept                # Has priority over the Accept header
  X-HTTP-Scheme           # Set by the reverse proxy, 'http' or 'https'

  # Requests that Content-Type header be text/plain
  X-Response-Type = "text/plain" # This is the only valid value

  # Indicates the response should be returned as an attachment
  X-Return-Disposition = "attachment" # This is the only valid value

IE lower-cases these header names in XHR->setHeader.

=pod:changes

  VERSION 0.3 on 2013-01-24 (Ryan)
  Added X-HTTP-Scheme so to support reverse-proxies which receive a request
  over SSL and forward to a plain http back-end.

  VERSION 0.2 on 2013-01-23 (Ryan)
  Added X-Accept header need for current AngularJS as all its request pass
  application/json as the first Accept header field, however the framework
  expects a text/html response.

=cut
