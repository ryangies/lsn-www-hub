Description=Service control for website domains
After=syslog.target network.target auditd.service

[Service]
ExecStart=/etc/livesite/init.d/domains start
ExecReload=/etc/livesite/init.d/domains restart

[Install]
WantedBy=multi-user.target
