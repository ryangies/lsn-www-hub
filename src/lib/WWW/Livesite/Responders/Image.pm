package WWW::Livesite::Responders::Image;
use strict;
our $VERSION = 0;

use Perl::Module;
use Error::Logical;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use WWW::Misc::Image qw(image_convert);
use base qw(WWW::Livesite::Responders::Base);

our $Watermark_Conf = '/sys/conf/handlers/image/watermark';
our $Tmp_Dir = 'response/images';

our $VERSION = 0.1;

sub needs_watermark {
  my $uri = shift;
  my $result = 0;
  if (my $paths = $Hub->get("$Watermark_Conf/paths")) {
    for ($paths->values) {
      if (index($uri, $_) == 0) {
        $result = 1;
        last;
      }
    }
  }
# $Hub->get('/sys/log')->warn("WATERMARK ($uri): $result");
  $result;
}

sub match_request {
  my ($uri, $res) = @_;
  return unless $uri =~ /\.(jpe?g|gif|png)$/i;
  return unless $res && -f $res->get_path;
  needs_watermark($uri);
}

sub compile {
  my $self = shift;
  my $resp = $Hub->get('/sys/response');
  my $addr = $resp->{'addr'};
  my $image = $Hub->get($addr) or throw Error::DoesNotExist;
  $image->get_mtime;  # add entry to fs_access_log
                      # note, image_convert takes care of mtime check
  my $src_path = $image->get_path;
  my $new_path = $src_path;
  my $convert = {};

  if (my $resize = $Hub->str('/sys/request/qs/resize')) {
    $$convert{'resize'} = $resize;
  }

  if (needs_watermark($addr)) {
    $$convert{'watermark'} = clone($Hub->get($Watermark_Conf), -pure_perl);
  }

  if (%$convert) {

    my $tmpdir = $Hub->get('/sys/tmp');
    my $out_dir = $tmpdir->get('/')->get_path . "/$Tmp_Dir";
    dir_create($out_dir);
    my $prefix = substr addr_parent($image->get_addr), 1;
    $prefix =~ s/\//_/g;

    my $opts = {
      %$convert,
      out_dir => $out_dir,
      out_fn_fmt => "${prefix}_<basename>_<width>x<height>.<ext>",
    };

    my $props = image_convert($src_path, -opts => $opts);
    $new_path = $props->{'path'};
    $resp->{'headers'}{'X-Image-Width'} = $$props{'width'};
    $resp->{'headers'}{'X-Image-Height'} = $$props{'height'};
    $resp->{'headers'}{'X-Image-DisplayWidth'} = $$props{'display_width'};
    $resp->{'headers'}{'X-Image-DisplayHeight'} = $$props{'display_height'};
    if ($$props{'zoom_info'}) {
      $resp->{'headers'}{'X-Image-OffsetLeft'} = $$props{'zoom_info'}{'x'};
      $resp->{'headers'}{'X-Image-OffsetTop'} = $$props{'zoom_info'}{'y'};
    }
  }

  return if ($$Hub{'/sys/request/method'} eq 'HEAD');

  if (my $attach = $Hub->str('/sys/request/qs/attach')) {
    my $fn = path_name($src_path);
    $fn =~ s/"/\\"/g;
    my $disp = sprintf 'attachment; filename="%s"', $fn;
    $resp->{'headers'}{'Content-Disposition'} = $disp;
  }
  $resp->{'send_file'} = $new_path;
  $resp->{'has_compiled'} = 1;
  $resp->{'can_cache'} = 1;
}

1;
