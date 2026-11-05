#!/usr/bin/env python3
"""
AE Digital Hub server: runs the Digi Hub, the Skills Matrix and New Hire Setup WITHOUT Claude.

One small program, Python 3.8 or newer, nothing to install (standard library only). It does three things:

  1. Serves the pages (the files in ./public).
  2. Stores their shared data in SQLite files in ./data (one file per app) and offers it to the pages through a tiny web API.
  3. Pushes every change to every open page the moment it happens (server-sent events), so the pages stay live
     exactly like they did inside Claude.

Run it:      python3 server.py
Then open:   http://localhost:8080/                (Digi Hub)
             http://localhost:8080/skills-matrix/  (Skills Matrix)
             http://localhost:8080/new-hire-setup/ (New Hire Setup)

Useful options (see --help): --host, --port, --data, --public, --user/--password (ask for a site password),
--cert/--key (serve over HTTPS), --backup-dir (daily copies of all data).

Other commands:
  python3 server.py import hub  ../data-backup/hub/_bundle.json      load a backup into an app
  python3 server.py export hub  hub-backup.json                      write an app's data to one file
"""
import argparse
import base64
import gzip
import hmac
import json
import mimetypes
import os
import queue
import re
import sqlite3
import ssl
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs

APPS = ('hub', 'skills-matrix', 'new-hire-setup')
NAME_RE = re.compile(r'^[A-Za-z0-9_.:@+\-]{1,200}$')
MAX_BODY = 1024 * 1024          # 1 MiB per request
MAX_DOC = 256 * 1024            # 256 KiB per record, same limit the Claude runtime had
OPTS = None


# ----------------------------------------------------------------------------- storage
class Store:
    """All records of one app, in one SQLite file, plus the list of pages listening for changes."""

    def __init__(self, path):
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, '
                        'version INTEGER NOT NULL, updated REAL NOT NULL, PRIMARY KEY (c, id))')
        self.db.commit()
        self.clients = {}   # page id -> {queue, watched collections}

    def _row(self, r):
        return {'id': r[0], 'data': json.loads(r[1]), 'version': r[2], 'updatedAt': r[3]}

    def list(self, c):
        with self.lock:
            rows = self.db.execute('SELECT id, data, version, updated FROM docs WHERE c=? ORDER BY id', (c,)).fetchall()
        return [self._row(r) for r in rows]

    def get(self, c, i):
        with self.lock:
            r = self.db.execute('SELECT id, data, version, updated FROM docs WHERE c=? AND id=?', (c, i)).fetchone()
        return self._row(r) if r else None

    def put(self, c, i, data, merge=False):
        with self.lock:
            cur = self.db.execute('SELECT data, version FROM docs WHERE c=? AND id=?', (c, i)).fetchone()
            if merge:
                if not cur:
                    raise KeyError('missing')
                new = json.loads(cur[0])
                new.update(data)
            else:
                new = data
            text = json.dumps(new, separators=(',', ':'), ensure_ascii=False)
            if len(text.encode('utf-8')) > MAX_DOC:
                raise ValueError('record too large')
            ver = (cur[1] + 1) if cur else 1
            self.db.execute('INSERT OR REPLACE INTO docs (c, id, data, version, updated) VALUES (?,?,?,?,?)',
                            (c, i, text, ver, time.time()))
            self.db.commit()
        self.notify(c)
        return ver

    def delete(self, c, i):
        with self.lock:
            self.db.execute('DELETE FROM docs WHERE c=? AND id=?', (c, i))
            self.db.commit()
        self.notify(c)

    # live updates: one stream per page (client), which can watch any number of collections
    def client(self, cid):
        with self.lock:
            cl = self.clients.get(cid)
            if not cl:
                cl = self.clients[cid] = {'q': queue.Queue(maxsize=400), 'watch': set(), 'seen': time.time()}
            cl['seen'] = time.time()
            return cl

    def drop_client(self, cid):
        with self.lock:
            self.clients.pop(cid, None)

    def watch(self, cid, names):
        cl = self.client(cid)
        for c in names:
            if c not in cl['watch']:
                cl['watch'].add(c)
            self._push(cl, c)                      # (re)send the current contents right away

    def _push(self, cl, c):
        payload = json.dumps({'c': c, 'docs': self.list(c)}, separators=(',', ':'), ensure_ascii=False)
        try:
            cl['q'].put_nowait(payload)
        except queue.Full:
            try:
                while True:
                    cl['q'].get_nowait()           # a slow page: drop its backlog and re-send what it watches
            except queue.Empty:
                pass
            for name in list(cl['watch']):
                try:
                    cl['q'].put_nowait(json.dumps({'c': name, 'docs': self.list(name)}, separators=(',', ':'), ensure_ascii=False))
                except queue.Full:
                    break

    def notify(self, c):
        with self.lock:
            targets = [cl for cl in self.clients.values() if c in cl['watch']]
        if not targets:
            return
        payload = json.dumps({'c': c, 'docs': self.list(c)}, separators=(',', ':'), ensure_ascii=False)
        for cl in targets:
            try:
                cl['q'].put_nowait(payload)
            except queue.Full:
                self._push(cl, c)

    def collections(self):
        with self.lock:
            return [r[0] for r in self.db.execute('SELECT DISTINCT c FROM docs ORDER BY c').fetchall()]

    def dump(self):
        out = {}
        for c in self.collections():
            out[c] = {d['id']: d['data'] for d in self.list(c)}
        return out


STORES = {}


def store_for(app):
    if app not in STORES:
        os.makedirs(OPTS.data, exist_ok=True)
        STORES[app] = Store(os.path.join(OPTS.data, app + '.db'))
    return STORES[app]


# ----------------------------------------------------------------------------- web
class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'AEHub/1.0'

    def log_message(self, fmt, *args):
        if OPTS.verbose:
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    # -- helpers
    def _send(self, code, body=b'', ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, separators=(',', ':'), ensure_ascii=False))

    def _authorized(self):
        if not OPTS.user:
            return True
        h = self.headers.get('Authorization', '')
        if h.startswith('Basic '):
            try:
                u, _, p = base64.b64decode(h[6:]).decode('utf-8').partition(':')
                ok_u = hmac.compare_digest(u.encode(), OPTS.user.encode())
                ok_p = hmac.compare_digest(p.encode(), OPTS.password.encode())
                return ok_u and ok_p
            except Exception:
                return False
        return False

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            raise ValueError('too large')
        raw = self.rfile.read(n) if n else b''
        return json.loads(raw.decode('utf-8')) if raw else None

    # -- routing
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._authorized():
            return self._send(401, b'Sign in required', 'text/plain', {'WWW-Authenticate': 'Basic realm="AE Digital Hub"'})
        p = urlparse(self.path)
        if p.path.startswith('/api/'):
            return self._api(p)
        return self._static(p.path)

    def do_PUT(self):
        self._write('PUT')

    def do_PATCH(self):
        self._write('PATCH')

    def do_POST(self):
        self._write('POST')

    def do_DELETE(self):
        self._write('DELETE')

    def _write(self, method):
        if not self._authorized():
            return self._send(401, b'Sign in required', 'text/plain', {'WWW-Authenticate': 'Basic realm="AE Digital Hub"'})
        p = urlparse(self.path)
        if not p.path.startswith('/api/'):
            return self._send(405, b'Not allowed', 'text/plain')
        return self._api(p, method)

    def _api(self, p, method='GET'):
        parts = [unquote(x) for x in p.path.split('/')[2:]]     # after /api/
        if len(parts) < 2 or parts[0] not in APPS:
            return self._json(404, {'error': 'unknown app'})
        app, rest = parts[0], parts[1:]
        st = store_for(app)
        try:
            if rest[0] == 'stream' and method == 'GET':
                cid = (parse_qs(p.query).get('id') or [''])[0]
                if not NAME_RE.match(cid):
                    return self._json(400, {'error': 'bad id'})
                return self._stream(st, cid)
            if rest[0] == 'watch' and method == 'POST':
                data = self._body() or {}
                cid, names = str(data.get('id', '')), data.get('c') or []
                if not NAME_RE.match(cid) or not isinstance(names, list) or not all(isinstance(n, str) and NAME_RE.match(n) for n in names):
                    return self._json(400, {'error': 'bad request'})
                st.watch(cid, names)
                return self._json(200, {'ok': True})
            if rest[0] != 'c' or len(rest) < 2 or not NAME_RE.match(rest[1]):
                return self._json(404, {'error': 'not found'})
            c = rest[1]
            if len(rest) == 2:
                if method == 'GET':
                    return self._json(200, {'docs': st.list(c)})
                if method == 'POST':
                    data = self._body()
                    if not isinstance(data, dict):
                        return self._json(400, {'error': 'expected an object'})
                    i = uuid.uuid4().hex[:20]
                    st.put(c, i, data)
                    return self._json(200, {'id': i})
                return self._json(405, {'error': 'method not allowed'})
            if len(rest) == 3 and NAME_RE.match(rest[2]):
                i = rest[2]
                if method == 'GET':
                    d = st.get(c, i)
                    return self._json(200, {'exists': bool(d), 'id': i, 'data': d['data'] if d else None, 'version': d['version'] if d else 0})
                if method in ('PUT', 'PATCH'):
                    data = self._body()
                    if not isinstance(data, dict):
                        return self._json(400, {'error': 'expected an object'})
                    ver = st.put(c, i, data, merge=(method == 'PATCH'))
                    return self._json(200, {'id': i, 'version': ver})
                if method == 'DELETE':
                    st.delete(c, i)
                    return self._json(200, {'ok': True})
            return self._json(404, {'error': 'not found'})
        except KeyError:
            return self._json(404, {'error': 'no such record'})
        except ValueError as e:
            return self._json(413 if 'large' in str(e) else 400, {'error': str(e)})
        except json.JSONDecodeError:
            return self._json(400, {'error': 'bad JSON'})

    def _stream(self, st, cid):
        cl = st.client(cid)
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Connection', 'close')
            self.send_header('X-Accel-Buffering', 'no')
            self.end_headers()
            self.wfile.write(b'retry: 2000\n\n')
            for name in list(cl['watch']):         # a page that reconnects gets everything it was watching again
                st._push(cl, name)
            self.wfile.flush()
            while True:
                try:
                    payload = cl['q'].get(timeout=15)
                    self.wfile.write(('event: snapshot\ndata: %s\n\n' % payload).encode('utf-8'))
                except queue.Empty:
                    self.wfile.write(b': keep-alive\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError, OSError):
            pass
        finally:
            st.drop_client(cid)
            self.close_connection = True

    def _static(self, path):
        path = unquote(path)
        pub = os.path.abspath(OPTS.public)
        if path.startswith('/skills-matrix'):
            base, rel = os.path.join(pub, 'skills-matrix'), path[len('/skills-matrix'):]
        elif path.startswith('/new-hire-setup'):
            base, rel = os.path.join(pub, 'new-hire-setup'), path[len('/new-hire-setup'):]
        elif path == '/claude-shim.js':
            base, rel = pub, path
        else:
            base, rel = os.path.join(pub, 'hub'), path
        if rel in ('', '/'):
            rel = '/index.html'
        if (path == '/skills-matrix' or path == '/new-hire-setup'):        # add the trailing slash so relative links work
            return self._send(301, b'', 'text/plain', {'Location': path + '/'})
        full = os.path.abspath(os.path.join(base, rel.lstrip('/')))
        if not full.startswith(base) or not os.path.isfile(full):
            return self._send(404, b'Not found', 'text/plain')
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
            ctype += '; charset=utf-8'
        with open(full, 'rb') as f:
            body = f.read()
        extra = None
        if len(body) > 20000 and 'gzip' in (self.headers.get('Accept-Encoding') or '') and (ctype.startswith('text/') or 'json' in ctype or 'javascript' in ctype):
            body = gzip.compress(body, 6)
            extra = {'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding'}
        self._send(200, body, ctype, extra)


# ----------------------------------------------------------------------------- backups, import, export
def backup_loop():
    os.makedirs(OPTS.backup_dir, exist_ok=True)
    last_day = None
    while True:
        day = time.strftime('%Y-%m-%d')
        if day != last_day:
            for app in APPS:
                path = os.path.join(OPTS.data, app + '.db')
                if os.path.exists(path):
                    out = os.path.join(OPTS.backup_dir, '%s-%s.json' % (app, day))
                    with open(out, 'w', encoding='utf-8') as f:
                        json.dump(store_for(app).dump(), f, ensure_ascii=False, indent=1)
            files = sorted(os.listdir(OPTS.backup_dir))
            for app in APPS:                                   # keep the newest 30 per app
                mine = [x for x in files if x.startswith(app + '-')]
                for old in mine[:-30]:
                    os.remove(os.path.join(OPTS.backup_dir, old))
            last_day = day
        time.sleep(3600)


def cmd_import(app, path):
    bundle = json.load(open(path, encoding='utf-8'))
    st = store_for(app)
    n = 0
    for c, docs in bundle.items():
        for i, data in docs.items():
            st.put(c, i, data)
            n += 1
    print('Imported %d records into %s' % (n, app))


def cmd_export(app, path):
    json.dump(store_for(app).dump(), open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Wrote', path)


def main():
    global OPTS
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description='Run the AE Digital Hub without Claude.')
    ap.add_argument('--host', default='127.0.0.1', help='address to listen on (use 0.0.0.0 to allow other computers)')
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--data', default=os.path.join(here, 'data'), help='folder for the database files')
    ap.add_argument('--public', default=os.path.join(here, 'public'), help='folder with the pages (made by make_standalone.py)')
    ap.add_argument('--user', default=os.environ.get('HUB_USER'), help='optional site sign-in name')
    ap.add_argument('--password', default=os.environ.get('HUB_PASSWORD'), help='optional site sign-in password')
    ap.add_argument('--cert', help='TLS certificate file (serve HTTPS)')
    ap.add_argument('--key', help='TLS key file')
    ap.add_argument('--backup-dir', help='write a daily copy of all data here (keeps 30 days)')
    ap.add_argument('--verbose', action='store_true')
    ap.add_argument('command', nargs='*', help='import <app> <file>  |  export <app> <file>')
    OPTS = ap.parse_args()
    if OPTS.user and not OPTS.password:
        ap.error('--user needs --password')
    if OPTS.command:
        if len(OPTS.command) == 3 and OPTS.command[0] == 'import' and OPTS.command[1] in APPS:
            return cmd_import(OPTS.command[1], OPTS.command[2])
        if len(OPTS.command) == 3 and OPTS.command[0] == 'export' and OPTS.command[1] in APPS:
            return cmd_export(OPTS.command[1], OPTS.command[2])
        ap.error('commands: import|export <hub|skills-matrix|new-hire-setup> <file>')
    srv = ThreadingHTTPServer((OPTS.host, OPTS.port), Handler)
    srv.daemon_threads = True
    scheme = 'http'
    if OPTS.cert:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(OPTS.cert, OPTS.key)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        scheme = 'https'
    if OPTS.backup_dir:
        threading.Thread(target=backup_loop, daemon=True).start()
    print('AE Digital Hub running at %s://%s:%d/  (data in %s)' % (scheme, 'localhost' if OPTS.host in ('0.0.0.0', '127.0.0.1') else OPTS.host, OPTS.port, os.path.abspath(OPTS.data)))
    if OPTS.host == '127.0.0.1':
        print('Only this computer can reach it. Use --host 0.0.0.0 to let your team connect.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
