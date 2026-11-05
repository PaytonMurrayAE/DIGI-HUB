#!/bin/sh
# Starts the Hub for your team. Edit the password below before using it.
cd "$(dirname "$0")"
python3 make_standalone.py
exec python3 server.py --host 0.0.0.0 --port 8080 --user team --password CHANGE-ME --backup-dir backups
