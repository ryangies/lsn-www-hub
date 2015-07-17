# PerlModule
use strict;
use Perl::Module;
use Error::Logical;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(:all);
use Mail::Sender;

sub ACCESS {
  return unless $Hub->get('/sys/user');
  1;
}

sub get {
  $Hub->set('/sys/response/headersCache-Control', 'no-cache');
  $Hub->set('/sys/response/headersLast-Modified', '0');
  my $token = $Hub->get('/sys/session')->get_auth_token();
  my $user = $Hub->get('/sys/user') or throw Error::AccessDenied;
  my $groups = $Hub->get('./form.hf/fieldsets/*/fields')
    or throw Error::Programatic;
  my $result = {};
  $groups->iterate(sub {
    my ($pkey, $fields) = @_;
    foreach my $k (keys %$fields) {
      my $def = $fields->{$k};
      $result->{$k} = $def->{type} eq 'password'
        ? $user->get($k) 
          ? '*****'
          : ''
        : $user->get($k) || '';
    }
  });
  return $result;
}

sub update {
  my ($opts, %params) = my_opts(\@_);
  my $user = $Hub->get('/sys/user') or throw Error::AccessDenied;
  my $un = $user->get_username;
  my $addr = addr_normalize("/sys/users/$un");
  throw Error::Security unless index($addr, '/sys/users/') == 0;
  my $record = $Hub->get($addr) or throw Error::Programatic;
  overlay($record, \%params);
  $Hub->addr_to_storage($addr)->save();
  'SUCCESS';
}

sub sendmail {

  my $params = {@_};

  my $connect = $Hub->get('/sys/user/prefs/smtp')
    or throw Error::Logical 'No SMTP preferences found for this user';

  # To support SALS authentication, need to setup this package:
  # yum install perl-Net-SMTP-SSL

	my $preamble = {
    smtp      => $connect->{'server'},
    auth      => $connect->{'auth_type'},
    authid    => $connect->{'auth_user'},
    authpwd   => $connect->{'auth_pass'},
    from      => $connect->{'auth_user'},
    to        => $params->{'mail-to'},
    cc        => $params->{'mail-cc'},
    bcc       => $params->{'mail-bcc'},
    subject   => $params->{'mail-subject'},
    multipart => 'related',
  };

  my $text_msg = $params->{'mail-text'};
  my $html_msg = $params->{'mail-html'};

  my $mailer = new Mail::Sender;
  $Mail::Sender::NO_X_MAILER = 1;

  eval {
    $mailer->OpenMultipart($preamble)->Part({ctype => 'multipart/alternative'});
    if ($text_msg) {
      $mailer->Part({ctype => 'text/plain', disposition => 'NONE', msg => $text_msg});
    }
    if ($html_msg) {
      $mailer->Part({ctype => 'text/html', disposition => 'NONE', msg => $html_msg});
    }
    $mailer->EndPart("multipart/alternative");
    $mailer->Close();
  } or die $Mail::Sender::Error;

  undef;

}

1;

__END__
