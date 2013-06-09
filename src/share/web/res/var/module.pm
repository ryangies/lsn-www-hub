# PerlModule
use strict;
use Time::Regex::Strptime qw(FMT_RFC822 FMT_GMT);
use Time::Piece;

sub now {
  my $t = localtime;
  $t->strftime(FMT_RFC822);
}

1;
