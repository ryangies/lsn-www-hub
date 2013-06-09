# PerlModule
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use WWW::Misc::Image qw(image_dims props_to_resize_str);
use Image::Size qw(imgsize);

sub get_image_info {
  my %params = @_;
  my $addr = $params{addr} or return;
  my $max_x = $params{width} or return;
  my $max_y = $params{height} or return;
  my $img = $Hub->get(_unescape($addr));
  my $path = $img->get_path;
  my ($w,$h) = image_dims($path, -max_x => $max_x, -max_y => $max_y);
  my $result = {
    addr => $addr,
    width => $w,
    height => $h,
  };
  $result;
}

sub _unescape {
  my $url = shift;
  $url =~ tr/+/ /;
  $url =~ s/%([a-fA-F0-9]{2})/pack("C",hex($1))/eg;
  $url;
}

1;
