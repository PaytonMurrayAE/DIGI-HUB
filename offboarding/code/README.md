# Code

## hub/
* `digi-hub.html` **The Hub.** The complete page as published (Version 353). This single file is the source of truth. It must be published together with the files in `heatmap-data/` (they are served at `heatmap/` beside the page and are already stored with the live artifact).
* `heatmap-data/` `zips.json`, `counties.json`, `us-topo.json`, `age.json`: map data loaded when the Heat map opens.
* `feature-modules/` readable copies of the newest features exactly as they were inserted into the page: `heatmap.js` and `heatmap.css` (Advisors > Heat map), `dashboard.js` (Advisors > Dashboard) and `dashboard-and-other-styles.css`. They are **for reading and reference**; edit `digi-hub.html`, which already contains them.
* `build-scripts/` the Ruby and Python scripts that applied each recent change to the previous version of the page. They are a record of how the Hub grew. They start from earlier versions of the page that are not included, so they cannot be re-run on their own and are not needed to maintain the Hub.
* `local-preview/` run the Hub on your computer against a pretend database. See its README.

## skills-matrix/
`skills-matrix.html`: the Skills Matrix page as published.

## new-hire-setup/
`index.html`: the older stand-alone New Hire Setup page as published.

## tools/
* `bundle-backup.py` combines the one-file-per-record backup into a single JSON file.
* `restore-snippet.js` advanced, untested outside Claude; see the Technical Handoff, section 9.

## Publishing changes
Described in the Technical Handoff, section 6C. In short: edit the file, test with `local-preview`, then publish it as a new version of the same artifact (this needs Claude, or another tool that can publish a Claude Artifact, and an account with edit access to the artifact).
