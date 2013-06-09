package WWW::Livesite::Responders::NML;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Parse::Template::Web;
use Data::Format::Nml::Document;
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

sub _parse {
  my $addr = shift;
  my $parser = $self->create_web_parser;
  my $text = $parser->get_compiled_value(\$addr);
  return unless $text;
  $text =~ s/</&lt;/g;
  $text =~ s/>/&gt;/g;
  my $doc = Data::Format::Nml::Document->new($text);
  $doc->to_string;
};

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  my $addr = $resp->{addr};
  $resp->{'headers'}{'Content-Type'} = 'text/html; charset=UTF-8';
  $resp->{'body'} = _parse($addr);
  $resp->{'can_cache'} = 1;
  $resp->format;
  $resp->encode;
}

1;
