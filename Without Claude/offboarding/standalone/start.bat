@echo off
rem Starts the Hub for your team. Edit the password below before using it.
cd /d "%~dp0"
py make_standalone.py
py server.py --host 0.0.0.0 --port 8080 --user team --password CHANGE-ME --backup-dir backups
