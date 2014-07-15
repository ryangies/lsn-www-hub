package WWW::Livesite::Responders::Directory;
use strict;
use Perl::Module;
use Data::Hub qw($Hub);
use Data::Hub::Util qw(FS);
use Error::Logical;
use base qw(WWW::Livesite::Responders::Base);

our $VERSION = 0.1;

# Since Apache knows nothing about our mount points, we must do the work
# normally done by mod_dir and mod_autoindex. In practice, if we set
# the finfo record then mod_autoindex will show the directory listing, 
# even when it is not suppose to (according to the Options directive).

# TODO If Options +Indexes is turned on, do not return an object in the
# contructor.

sub internal_redirect {
  my $self = shift;
  my $uri = shift;
  my $resp = $Hub->{sys}{response};
  $resp->{'internal_redirect'} = $uri;
}

sub client_redirect {
  my $self = shift;
  my $uri = shift;
  my $resp = $Hub->{sys}{response};
  $resp->{headers}{'Location'} = $uri;
}

sub compile {
  my $self = shift;
  my $resp = $Hub->{sys}{response};
  my $uri = $self->{uri};
  my $res = $self->{res};

  # DirectorySlash equivilent
  if (substr($uri, -1) ne '/') {
    return $self->client_redirect($uri . '/');
  }

  # Index file (trumps sitemap)
  if (my $indexes = $Hub->{sys}{server}{config}{indexes}) {
    foreach my $name (@$indexes) {
      if (exists $$res{$name}) {
        # Yes, there is an index, redirect accordingly.
        return $self->internal_redirect("$uri$name");
      }
    }
  }

  # First page according to sitemap
  if (my $sitemap_addr = $Hub->{sys}{conf}->get('ext/sitemap/addr')) {
    if (my $sitemap = $Hub->get($sitemap_addr)) {
      if (my $entry = $sitemap->get($res->get_addr)) {
        for ($entry->keys) {
          /^\./ and next;
          my $node = $$res{$_};
          if (isa($node, FS('Directory'))) {
            return $self->client_redirect($node->get_addr . '/');
          } elsif (isa($node, FS('File'))) {
            return $self->internal_redirect($node->get_addr);
          }
        }
      }
    }
  }

  throw Error::DoesNotExist 'Directory listings not allowed';

}

1;
