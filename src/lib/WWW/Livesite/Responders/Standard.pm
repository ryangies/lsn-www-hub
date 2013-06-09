package WWW::Livesite::Responders::Standard;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Parse::Template::Web;
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  my $addr = $resp->{addr};
  my $parser = $self->create_web_parser;
  $resp->{'body'} = $parser->compile($addr);
  $resp->{'can_cache'} = $Hub->get('/sys/request/method') eq 'GET';
  $resp->format;
  $resp->encode;
}

1;
