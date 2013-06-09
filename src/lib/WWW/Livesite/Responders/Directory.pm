package WWW::Livesite::Responders::Directory;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Error::Logical;
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

# Since Apache knows nothing about our mount points, we must do the work
# normally done by mod_dir and mod_autoindex. In practice, if we set
# the finfo record then mod_autoindex will show the directory listing, 
# even when it is not suppose to (according to the Options directive).

# TODO If Options +Indexes is turned on, do not return an object in the
# contructor.

sub _redir {
  my $self = shift;
  my $name = shift;
  my $resp = $Hub->{sys}{response};
  my $uri = $self->{uri};
  my $params = $Hub->{sys}{request}{qs}->to_string;
  $resp->{'internal_redirect'} = $params
    ? "$uri$name?$params"
    : "$uri$name";
}

sub compile {
  my $self = shift;
  my $resp = $Hub->{sys}{response};
  my $uri = $self->{uri};
  my $res = $self->{res};

  # DirectorySlash equivilent
  if (substr($uri, -1) ne '/') {
    $resp->{headers}{'Location'} = $uri . '/';
    return;
  }

  # Index file
  if (my $indexes = $Hub->{sys}{server}{config}{indexes}) {
    foreach my $name (@$indexes) {
      if (exists $$res{$name}) {
        # Yes, there is an index, redirect accordingly.
        return $self->_redir($name);
      }
    }
  }

  # First page according to sitemap
  if (my $sitemap_addr = $Hub->{sys}{conf}->get('ext/sitemap/addr')) {
    if (my $sitemap = $Hub->get($sitemap_addr)) {
      if (my $entry = $sitemap->get($res->get_addr)) {
        for ($entry->keys) {
          /^\./ and next;
          return $self->_redir($_);
        }
      }
    }
  }

  throw Error::DoesNotExist 'Directory listings not allowed';

}

1;
