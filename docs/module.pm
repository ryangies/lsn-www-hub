# PerlModule
use feature ':5.10';
use strict;
use Perl::Module;
use Parse::JavaScript::Doc qw(def_to_html);

sub as_html {
  my ($opts, %params) = my_opts(\@_);
  return def_to_html($params{def});
}

sub as_html_id {
  my %params = @_;
  my $definition = $params{'definition'};
  my @id_parts = split /\./, $$definition{'id'};
  my $id_name = pop @id_parts;
  my $id_prefix = join '.', @id_parts;
  my $id_string = undef;
  given ($$definition{'type'}) {
    when('namespace') {
      $id_string = sprintf '%s.%s', $id_prefix, $id_name;
    }
    when('class') {
      $id_string = sprintf '%s.<b>%s</b>', $id_prefix, $id_name;
    }
    when('function') {
      my $class_name = pop @id_parts;
      $id_prefix = join '.', @id_parts;
      $id_string = sprintf '%s.%s.<u>%s()</u>', $id_prefix, $class_name, $id_name;
    }
    default {
      $id_string = sprintf '%s.%s', $id_prefix, $id_name;
    }
  }
  return $id_string;
  return sprintf "%s - %s", $id_string, $$definition{'type'};
}

1;
