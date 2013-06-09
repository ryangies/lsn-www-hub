# PerlModule
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use Perl::Clone qw(clone);
use Algorithm::KeyGen;

our $KeyGen = Algorithm::KeyGen->new(6);
our @per_elem_styles = qw(width height top left position display);

sub render_doc {
  my ($opts, %argv) = my_opts(\@_);
  my $ds = $argv{'ds'} || $Hub->{'/sys/request/page/uri'}
    or throw Error::Logical 'No datasource provided';
  my $data = clone($Hub->get($ds), -keep_order);
  my $css = {};
  _gen_css($$data{'elements'}, $css);
  return _compose($data, $css);
}

sub _compose {
  my ($data, $css) = @_;
  my $result = '';
  my $class_ref = {};
  if ($css) {
    $result .= "[#:css]";
    foreach my $id (keys %$css) {
      $id eq 'classes' and next;
      $result .= "#$id\{$$css{$id}\}\n";
    }
    if ($$css{'classes'}) {
      foreach my $def (keys %{$$css{'classes'}}) {
        my $class_name = 'c' . $KeyGen->create();
        $result .= ".$class_name\{$def\}\n";
        foreach my $id (@{$$css{'classes'}{$def}}) {
          $$class_ref{$id} ||= [];
          push @{$$class_ref{$id}}, $class_name;
        }
      }
    }
    $result .= "[#:end css]";
  }
  $$data{'head'}{'css'} and $result .= "[#:css]" . $$data{'head'}{'css'} . "[#:end css]";
  $$data{'head'}{'js'} and $result .= "[#:js]" . $$data{'head'}{'js'} . "[#:end js]";
  $result .= _compose_elements($$data{'elements'}, $class_ref);
  return $result;
}

sub _compose_elements {
  my ($elems, $class_ref) = @_;
  my $result = '';
  return '' unless isa($elems, 'ARRAY');
  foreach my $elem (@$elems) {
    if ($$elem{'tagName'} =~ /^#/) {
      $result .= $$elem{'text'};
      next;
    }
    $result .= '<' . $$elem{'tagName'};
    if ($$class_ref{$$elem{'attrs'}{'id'}}) {
      $$elem{'attrs'}{'class'} ||= '';
      $$elem{'attrs'}{'class'} =
        join ' ', ($$elem{'attrs'}{'class'}, @{$$class_ref{$$elem{'attrs'}{'id'}}});
    }
    foreach my $a (keys %{$$elem{'attrs'}}) {
      next if ($a eq 'style');
      $result .= " $a=\"" . $$elem{'attrs'}{$a} . '"';
    }
    $result .= '>';
#   $result .= $$elem{'textContent'} || '';
    $result .= _compose_elements($$elem{'childNodes'}, $class_ref);
    $result .= '</' . $$elem{'tagName'} . ">\n";
  }
  return $result;
}

sub _gen_css {
  my ($elems, $css) = @_;
  return unless isa($elems, 'ARRAY');
  foreach my $elem (@$elems) {
    $elem = curry($elem);
    my $style = $elem->get('attrs/style');
    if ($style) {
      foreach my $k (keys %$style) {
        my $def = "$k:$$style{$k};";
        my $id = $elem->get('attrs/id');
        if (grep {$k eq $_} @per_elem_styles) {
          $$css{$id} ||= '';
          $$css{$id} .= $def;
        } else {
          $$css{'classes'}{$def} ||= [];
          push @{$$css{'classes'}{$def}}, $elem->get('attrs/id');
        }
      }
    }
    if ($$elem{'childNodes'}) {
      _gen_css($$elem{'childNodes'}, $css);
    }
  }
}

1;
