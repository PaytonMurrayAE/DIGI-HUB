# Data backup (October 30, 2026)

One folder per page, one folder per collection, one JSON file per record. The file name is the record's id; the file holds its fields.

* `hub/` 297 records in 24 collections, plus `_bundle.json` (all of it in one file). Collections with no records (for example `ad_spend`, `waitlist`, `playbooks`) are not listed.
* `skills-matrix/` the 10 survey responses in `responses/`, `_bundle.json`, and `skills-matrix-results.csv` (95 skills down, people across, ratings 1 to 5; blank = not rated).
* `new-hire-setup/` the one hire and one session recorded on the older stand-alone page.

**Left out on purpose:** the Hub's `site_access` collection (the two Advisors password hashes). After a rebuild, set the two passwords again in Admin > Advisors access.

**Sensitive:** team contact details, booking links, advisor and fee data, and individual Skills Matrix ratings. Keep management only.

To restore, see the Hub Technical Handoff, section 9. To make a fresh backup, ask Claude to back up every collection (same section).
