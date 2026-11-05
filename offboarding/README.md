# AE Digital: Digi Hub, Skills Matrix and New Hire Setup, offboarding package
Prepared October 30, 2026 (Hub Version 353).

## Start here
| Open this | If you are |
|---|---|
| `documents/01-Hub-Owners-Handbook.docx` | running the Hub day to day (read first) |
| `documents/02-Hub-Routines-Checklist.docx` | doing the monthly, quarterly and yearly jobs, or handling someone joining or leaving |
| `documents/03-Hub-Technical-Handoff.docx` | maintaining the code, the database or the backups |
| `documents/04-Skills-Matrix-Handbook.docx` | running the Skills Matrix survey |
| `documents/05-New-Hire-Setup-Guide.docx` | looking at the older stand-alone new-hire page |

## What is in the folders
* `documents/` the five Word documents above.
* `code/hub/` the Hub (`digi-hub.html`), its map data files, readable copies of the newest feature code, build history, and a local test setup.
* `code/skills-matrix/` and `code/new-hire-setup/` the other two pages.
* `code/tools/` helper scripts for the backup files.
* `data-backup/` every record in the three databases as of the date above, plus a spreadsheet of the Skills Matrix results.

## The three live pages
* Digi Hub: https://claude.ai/artifact/QrGTr4Fkxqwhq1iMku5PGE
* Skills Matrix: https://claude.ai/artifact/DJ5ZFh91Q43keGRufrDAWc
* New Hire Setup (older, see its guide): https://claude.ai/artifact/GjLWzwvTSEoiLXtFxrR66P

## Handle with care
* `data-backup/` contains team contact details, booking links, advisor and fee information, and everyone's Skills Matrix ratings. Keep it with management only.
* The code files contain a management passcode constant (Hub and Skills Matrix). Treat the code folder as sensitive too and change the passcodes after handoff (Technical Handoff, section 8).
* The Hub's Advisors passwords are not in the backup (only their one-way hashes exist, and those are left out on purpose). Set them again in Admin if the Hub is ever rebuilt.

## Before the current owner leaves
Give a successor edit access on all three pages (each page's Share menu) and confirm they can publish. See the last section of the Routines Checklist.
