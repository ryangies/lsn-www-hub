# PerlModule
use strict;
use Error::Simple;
use Data::Hub qw($Hub);
use Perl::Module;

sub login {
  my ($opts, %args) = my_opts(\@_);
  if ($Hub->get('/sys/session')->login($args{'un'}, $args{'h2'})) {
    return 'true';
  } else {
    sleep 2;
    my $nonce = get_nonce();
    throw Error::Simple "Login failed; nonce=$nonce;";
  }
}

sub get_nonce {
  $Hub->set('/sys/response/headers/<next>', ['Cache-Control', 'no-cache']);
  $Hub->set('/sys/response/headers/<next>', ['Last-Modified', '0']);
  $Hub->get('/sys/session')->get_auth_token();
}

sub logout {
  $Hub->get('/sys/session')->logout();
}

1;
