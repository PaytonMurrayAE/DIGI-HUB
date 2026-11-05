# Run the AE Digital Hub without Claude

This folder lets you run **the Digi Hub, the Skills Matrix and New Hire Setup on your own computer or server**, with no Claude account and nothing to install except Python.

* `server.py` serves the pages, stores their data (SQLite files in `data/`) and pushes live updates to everyone who has a page open.
* `claude-shim.js` is a stand-in for the Claude page runtime, so the pages work **unchanged**.
* `make_standalone.py` builds `public/` from the page files in `source/`.
* `public/` is already built, so you can run it straight away.
* `source/` the three pages exactly as they were published in Claude (Hub Version 353), plus the map data files.
* `06-Running-the-Hub-Without-Claude.docx` the full guide: setup, hosting, security, backups, limits.

## Quick start (5 minutes)
1. Install **Python 3.8 or newer** (https://www.python.org/downloads/). Nothing else is needed.
2. In this folder run: `python3 server.py`   (Windows: `py server.py`)
3. Open http://localhost:8080/ . You will see the Hub, empty.
4. Load your data (optional, recommended): `python3 server.py import hub ../data-backup/hub/_bundle.json`
   (The bundle comes from the main handoff package. You can run this while the server is running; refresh the browser afterwards.)
5. Management passcode and the two Advisors passwords: the management passcode is in the page code (see the Technical Handoff). Set the two Advisors passwords again in Admin > Advisors access (the backup does not contain them).

Other addresses on the same server: `/skills-matrix/` and `/new-hire-setup/`.

## Letting your team use it
```
python3 server.py --host 0.0.0.0 --port 8080 --user team --password CHOOSE-ONE --backup-dir backups
```
* `--host 0.0.0.0` lets other computers connect (use the server's address, e.g. http://192.168.1.20:8080/).
* `--user` / `--password` asks everyone for a site sign-in before they can see anything. This is **real protection** for the whole site (see the guide).
* `--backup-dir` writes a full copy of all data every day and keeps 30 days.
* For HTTPS: `--cert fullchain.pem --key privkey.pem` (or put a web server such as Caddy or nginx in front).
  **Use HTTPS or localhost.** The Advisors passwords are scrambled in the browser with a function that only exists on secure pages.

## Backups and moving the data
* `python3 server.py export hub hub-backup.json` writes all Hub data to one file. Same for `skills-matrix` and `new-hire-setup`.
* `python3 server.py import hub hub-backup.json` loads it back (records with the same id are overwritten).
* The real data is the files in `data/` (`hub.db`, `skills-matrix.db`, `new-hire-setup.db`). Copy that folder to move or back up everything.

## Changing the Hub page
Edit `source/hub/digi-hub.html`, run `python3 make_standalone.py`, and refresh the browser (the server does not need to restart).

## Running it all the time
* **Linux (systemd):** see `hub.service`. **Docker:** see `Dockerfile` (neither was tested here).
* **Mac / Windows:** `start.sh` / `start.bat` start it with sensible options. Leave the window open, or use your system's way to run a program at login.

## What is different from the Claude version
No Claude. Everything else behaves the same. See the guide for the short list of differences (the main one: the page cannot tell who is viewing, so the site password and the Hub's own lock screens are the only access control).
