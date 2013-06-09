package WWW::Livesite::Responders::Empty;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  $resp->{'body'} = str_ref('');
}

1;
