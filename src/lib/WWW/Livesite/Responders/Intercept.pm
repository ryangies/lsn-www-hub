package WWW::Livesite::Responders::Intercept;
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
  $resp->format;
  $resp->encode;
  # Write body to file, then have PHP serve up this file
  my $tmp_addr = $addr . '.out';
  my $tmp_file = $Hub->set($tmp_addr, $resp->{'body'})->save();
  my $params = $Hub->get('/sys/request/qs')->to_string;
  $resp->{'internal_redirect'} = "$tmp_addr?$params";
}

1;
