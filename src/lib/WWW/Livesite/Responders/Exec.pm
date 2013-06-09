package WWW::Livesite::Responders::Exec;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Parse::Template::Web;
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

sub get_permission_mode {
  'rx';
}

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  my $cgi = $Hub->{'/sys/request/cgi'} || {};
  my $result = &{$$self{'res'}}(%$cgi);
  return unless defined $result;
  if ($resp->get('standalone')) {
    $resp->{body} = $result;
  } elsif (ref($result) && !isa($result, 'SCALAR')) {
    $resp->{body} = $result;
  } else {
    my $parser = $self->create_web_parser;
    my $text = str_ref($result);
    $resp->{body} = $parser->compile_text($text);
  }
  $resp->format;
}

1;
