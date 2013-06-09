#!/bin/bash

# https://fedoraproject.org/wiki/Packaging:Systemd#Basic_format

script_path=$(readlink -f $0)
script_dir=$(dirname $script_path)

service_name='lsn-domains.service'

system_unit_dir=$(pkg-config systemd --variable=systemdsystemunitdir)
system_conf_dir=$(pkg-config systemd --variable=systemdsystemconfdir)
service_unit_path="$system_unit_dir/$service_name"
service_conf_path="$system_conf_dir/$service_name"

lsn-tc "$script_dir/domains.service.t" > $service_unit_path
echo "Wrote: $service_unit_path"

# if [ -e "$service_conf_path" ]; then
#   unlink $service_conf_path
# fi

  # Make symbolic link
# ln -s $service_unit_path $service_conf_path

  # Make systemd take notice of it
# systemctl daemon-reload

  # Enable a service to be started on bootup
# systemctl enable $service_name

  # Activate a service immediately
# systemctl start $service_name