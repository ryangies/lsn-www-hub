Description=Service control for NGiNX
After=syslog.target network.target auditd.service

[Service]
ExecStart=/etc/livesite/init.d/nginx start
ExecReload=/etc/livesite/init.d/nginx restart

[Install]
WantedBy=multi-user.target
