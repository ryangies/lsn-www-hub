package WWW::Livesite::Responders::Data;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  $resp->{'body'} = $self->{'res'};
  $resp->{'can_cache'} = 1;
  $resp->format;
  $resp->encode;
}

1;
