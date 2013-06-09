#!/bin/bash
description='Service control for NGiNX'
service_name='nginx.service'
service_impl="/lib/systemd/system/$service_name"
service_link="/etc/systemd/system/$service_name"

echo "[Unit]
Description=$description
After=syslog.target network.target

[Service]
Type=simple
ExecStart=/etc/livesite/init.d/nginx start
ExecReload=/etc/livesite/init.d/nginx restart

[Install]
WantedBy=network.target
" > $service_impl

if [ -e "$service_link" ]; then
  unlink $service_link
fi

# Make symbolic link
ln -s $service_impl $service_link

# Make systemd take notice of it
systemctl daemon-reload

# Activate a service immediately
systemctl start $service_name

# Enable a service to be started on bootup
systemctl enable $service_name
