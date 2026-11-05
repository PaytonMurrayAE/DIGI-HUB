#!/usr/bin/env python3
"""Builds ./public (the folder server.py serves) from the page files in ./source.

It copies each page and adds one line, before the page's first script, that loads claude-shim.js
(the stand-in for the Claude runtime). Nothing else in the pages is changed.

  python3 make_standalone.py
"""
import os, shutil

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'source')
pub = os.path.join(here, 'public')


def inject(html, app):
    i = html.index('<script')
    return html[:i] + '<script src="/claude-shim.js" data-app="%s"></script>' % app + html[i:]


def write(rel, text):
    path = os.path.join(pub, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)


shutil.rmtree(pub, ignore_errors=True)
os.makedirs(pub)
shutil.copy(os.path.join(here, 'claude-shim.js'), os.path.join(pub, 'claude-shim.js'))

# The Digi Hub, served at /
hub = open(os.path.join(src, 'hub', 'digi-hub.html'), encoding='utf-8').read()
write('hub/index.html', inject(hub, 'hub'))
hm = os.path.join(pub, 'hub', 'heatmap')
os.makedirs(hm)
for f in os.listdir(os.path.join(src, 'hub', 'heatmap-data')):
    shutil.copy(os.path.join(src, 'hub', 'heatmap-data', f), hm)

# The Skills Matrix, served at /skills-matrix/
sm = open(os.path.join(src, 'skills-matrix', 'skills-matrix.html'), encoding='utf-8').read()
write('skills-matrix/index.html', inject(sm, 'skills-matrix'))

# New Hire Setup, served at /new-hire-setup/  (its "back to the Hub" link now points at this server's Hub)
nh = open(os.path.join(src, 'new-hire-setup', 'index.html'), encoding='utf-8').read()
nh = nh.replace('https://claude.ai/artifact/QrGTr4Fkxqwhq1iMku5PGE', '/')
write('new-hire-setup/index.html', inject(nh, 'new-hire-setup'))

print('Built', pub)
