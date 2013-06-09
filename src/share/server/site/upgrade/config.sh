#!/bin/bash

# The path to the VirtualHost home directory is the first parameter
vh=$1

# The standard use line overlays these hashes (in priority order)
use_std='config/services.hf/livesite,config/services.hf/global,file:/etc/livesite/config.hf'

if [ ! -e $vh/config/services.hf ]; then

  if [ -e $vh/opt/livesite ]; then
    params="dir-livesite-share=$vh/opt/livesite/share use-lib=$vh/opt/livesite/lib"
  fi

  # The services.hf configuration file maintains the service-related settings
  # for the domain.
  lsn-tc services.hf config/services.hf -use=file:/etc/livesite/config.hf $params

    # This is a local install
    $conf = Data::OrderedHash->new(
  livesite => %{
    enable-livesite     => 1
    dir-livesite-conf   => [#dir-livesite-conf]
    dir-livesite-share  => [#dir-livesite-share]
    use-lib             => [#use-lib]
  }
  } else {
    # User server settings
  global => %{
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


set name=John
set amount=123
echo John > name

vivify config/services.hf
setv config/services.hf \
  enable-livesite 1 \
  dir-livesite-conf 
setv config/services.hf/enable-livesite 1
setv 
parse foo.txt > result.out
