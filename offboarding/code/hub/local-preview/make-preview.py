#!/usr/bin/env python3
"""Builds a local copy of the Hub that talks to a pretend in-memory database (mock.js)
instead of the real shared one, so you can change and test the page without touching live data.

  python3 make-preview.py          # creates index.html and heatmap/ next to this file
  python3 -m http.server 8766      # then open http://localhost:8766/

The pretend database starts empty and resets on every reload. See README.md for how to load sample data."""
import os, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', 'digi-hub.html')
html = open(src, encoding='utf-8').read()
i = html.index('<script')
html = html[:i] + '<script src="mock.js"></script>' + html[i:]
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(html)
dst = os.path.join(here, 'heatmap')
os.makedirs(dst, exist_ok=True)
for f in os.listdir(os.path.join(here, '..', 'heatmap-data')):
    shutil.copy(os.path.join(here, '..', 'heatmap-data', f), dst)
print('Done. Now run:  python3 -m http.server 8766   and open http://localhost:8766/')
