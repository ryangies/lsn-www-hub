####                                                                        ####
#### This directory is not yet in use.  Lots of ideas, nothing concrete...  ####
####                                                                        ####

# The standard use line overlays these hashes (in priority order)
use_std='config/services.hf/livesite,config/services.hf/global,file:/etc/livesite/config.hf'

lsn_dir='/usr/share/livesite'

if [ ! -e "$vhost_dir/opt/livesite" ]; then
  ln -s /opt/livesite "$vhost_dir/opt/livesite"
fi

# The services.hf configuration file maintains the service-related settings
# for the domain.
lsn-tc services.hf -use=file:/etc/livesite/config.hf

    # This is a local install
    $conf = Data::OrderedHash->new(
  livesite => %{
    enable-livesite     => 1
    dir-livesite-conf   => [#dir-livesite-conf]
    dir-livesite-share  => [#lsn-dir]/share
    use-lib             => [#lsn-dir]/lib
  }
  } else {
    # User server settings
    $conf = Data::OrderedHash->new(
      'enable-livesite'     => 1,
      'dir-livesite-conf'   => $$server{'dir-livesite-conf'},
      'dir-livesite-share'  => $$server{'dir-livesite-share'},
      'dir-livesite-lib'    => $$server{'dir-livesite-lib'},
      'dir-hub-lib'         => $$server{'dir-hub-lib'},
    );
  }
  my $global = Data::OrderedHash->new(
    'domain'              => $$self{'domain'},
    'port'                => $$server{'port'},
    'production'          => $$server{'production'},
    'log_level'           => $$server{'log_level'},
    'enable-gzip'         => $$server{'enable-gzip'},
    'force-www'           => 0,
  );
 

lsn-hf
  mk HashFile config/services.hf
  mk HASH config/services.hf/global
  mk HASH config/services.hf/livesite
  config/services.hf/livesite/enable-livesite = 1
  use file:/etc/livesite/config.hf as server
  use config/services.hf/livesite as site
  site/
  cp dir-livesite-conf config/services.hf/

# The livesite configuration is now kept in its own file.
mkdir config/apache.d/inc
lsn-tc apache.d/inc/livesite.conf -use=$use_std


[livesite]

  /config/services.hf
    port <= /sys/conf/proxy/port
    domain <= /sys/conf/proxy/domain


  use /config/services.hf
  config/


  {/var/www}            [#dir-vhost-root]
  {example.com}         [#domain]
  {/usr/share/livesite} [#dir-livesite-share]

  set domain {example.com}
  set port {80}
  set production {1}
  set enable-gzip {1}

init.tms

  chdir   {/var/www}/{example.com}
  connect {/usr/share/livesite}/server/site

enable-www.tms

  use ./config/services.hf/global
  use ./config/services.hf/livesite
  use file:/etc/livesite/config.hf

  compile /config/apache.conf
  compile /config/apache.d/www.conf
  mkdir ./log
  mkdir ./htdocs

enable-livesite.tms

  use ./config/services.hf/global
  use ./config/services.hf/livesite
  use file:/etc/livesite/config.hf

  mkdirs ./config/apache.d/inc
  compile /config/apache.d/www.conf
  compile /config/livesite-base.hf
  compile /config/livesite.hf --orphan

enable-svn.tms

  chdir ./repo
  exec svnadmin create
