package WWW::Livesite::Responders::Redirect;
use strict;
use Perl::Module;
use Error::Logical;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use WWW::Livesite::Responders::Base;
use Algorithm::KeyGen qw($KeyGen);

our @ISA = qw(WWW::Livesite::Responders::Base);

sub _get_config {
# my $site_config_addr = $Hub->get('/sys/conf/site-config/addr');
# my $site_config = $Hub->get($site_config_addr);
# my $config = $$site_config{'redirects'};
}

sub MATCH {
  # URI + Query String
  my $href = _decode_uri($Hub->get('/sys/request/page/href'));
  # Redirects
  my @redirects = (
    $Hub->get('/web/data/aliases.hf/compiled'),
    $Hub->get('/web/data/redirects.hf/redirect'),
  );
  if (my $rule = _get_rule($href, @redirects)) {
    $$Hub{'/sys/response/headers/Location'} = $$rule{'url'};
    $$Hub{'/sys/response/headers/Status'} = $$rule{'status'} || 302;
    return 1;
  }
  # Gone
  my @goners = (
    $Hub->get('/web/data/redirects.hf/gone'),
  );
  if (my $rule = _get_rule($href, @goners)) {
    $$Hub{'/sys/response/headers/Status'} = 410;
    return 1;
  }
  0;
}

sub _decode_uri {
  my $value = shift or return;
  $value =~ tr/+/ /;
  $value =~ s/%([a-fA-F0-9]{2})/pack("C",hex($1))/eg;
  utf8::decode($value);
  $value;
}

sub _get_rule {
  my $uri = shift;
  foreach my $list (@_) {
    my $rule = grep_first {_compare_rule($uri, $_)} $list->values;
    return $rule if $rule;
  }
  undef;
}

# 0 => Exact
# 1 => Begins with
# 2 => Ends with
# 3 => Substring
# 4 => Regular expression
sub _compare_rule {
  my $uri = shift;
  my $rule = shift;
  my $match = $$rule{'match'} || 0;
  my $path = $$rule{'url_path'};
  if ($$rule{'ignore_case'}) {
    $uri = lc($uri);
    $path = lc($path);
  }
  return _compare($uri, $match, $path)
    || (($match == 0 && $uri !~ '/$' && $path =~ s'/$'')
      ? _compare($uri, $match, $path)
      : 0);
}

sub _compare {
  my ($uri, $match, $path) = @_;
# warnf "_compare: %s %s %s\n", @_;
  if ($match == 1) {
    return index($uri, $path) == 0;
  } elsif ($match == 2) {
    my $i = rindex($uri, $path);
    return $i >= 0 && $i == (length($uri) - length($path));
  } elsif ($match == 3) {
    index($uri, $path) >= 0;
  } elsif ($match == 4) {
    return $uri =~ $path;
  } else {
    return $uri eq $path;
  }
  undef;
}

sub compile {
  my $self = shift;
}

1;
