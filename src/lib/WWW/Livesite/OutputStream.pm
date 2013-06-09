package WWW::Livesite::OutputStream;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Data::Format::XFR;
use Algorithm::KeyGen;

our $BoundaryGen = Algorithm::KeyGen->new(36, '0-9a-zA-Z');

sub new {
  my $class = ref($_[0]) ? ref(shift) : shift;
  my $r = $Hub->get('/sys/request/obj');
  my $data_encoding = 'base64';
  my $boundary = $data_encoding eq 'base64' ? ';' : $BoundaryGen->create();
  my $xfr = Data::Format::XFR->new($data_encoding);
  my $self = bless {
    'r' => $r,
    'boundary' => $boundary,
    'xfr' => $xfr,
    'data_encoding' => $data_encoding,
    'has_begun' => 0,
  }, $class;
  $self;
}

sub begin_output {
  my $self = shift;
  my $r = $$self{r};
  $Hub->set('/sys/response/standalone', 1);
  $r->headers_out->set('X-Content-Format', 'text/data-xfr');
  $r->headers_out->set('X-Content-Encoding', $$self{data_encoding});
  $r->headers_out->set('X-Content-Charset', 'UTF-8');
  $r->content_type("multipart/data-xfr; boundary=$$self{boundary}");
  $r->rflush();
  $$self{has_begun} = 1;
  return $self;
}

sub append {
  my $self = shift;
  $self->begin_output() unless $$self{has_begun};
  my $r = $$self{r};
  $r->print($$self{xfr}->format(@_), $$self{boundary});
  $r->rflush();
  return $self;
}

1;
