#!/usr/bin/env python3
"""Combines the one-file-per-record backup (data-backup/<app>/<collection>/<id>.json) into a single
bundle:  { "collection": { "docId": { ...fields... } } }  - easier to move around or to feed to a restore."""
import json, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data-backup', 'hub')
bundle = {}
for coll in sorted(os.listdir(root)):
    p = os.path.join(root, coll)
    if not os.path.isdir(p): continue
    bundle[coll] = {}
    for f in sorted(os.listdir(p)):
        if f.endswith('.json'):
            bundle[coll][f[:-5]] = json.load(open(os.path.join(p, f), encoding='utf-8'))
out = os.path.join(root, '_bundle.json')
json.dump(bundle, open(out, 'w', encoding='utf-8'), indent=1)
print('wrote', out, '-', sum(len(v) for v in bundle.values()), 'records in', len(bundle), 'collections')
