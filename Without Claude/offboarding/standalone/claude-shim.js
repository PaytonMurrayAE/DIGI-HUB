/*
 * AE Digital Hub: stand-in for the Claude page runtime.
 *
 * The Hub, the Skills Matrix and New Hire Setup were built to run inside Claude, where the page gets a shared database,
 * a "who is viewing" check and a file-save helper from an object called window.claude. This file provides the same
 * object, backed by server.py, so the pages run unchanged on your own server.
 *
 * It must load BEFORE the page's own scripts (make_standalone.py adds it for you):
 *     <script src="/claude-shim.js" data-app="hub"></script>
 * data-app is "hub", "skills-matrix" or "new-hire-setup" and picks which database the page talks to.
 *
 * Provided:
 *   claude.use('db')         collection(name).doc(id).get/set/update/delete/onSnapshot, .add, .get, .onSnapshot,
 *                            .where/.orderBy/.limit (done in the page), and db.doc('collection/id')
 *   claude.use('user')       canEdit() / isOwner() are true: access is controlled by the Hub's own lock screens
 *                            and, if you want a real gate, by the server's --user/--password option
 *   claude.use('downloads')  save({filename, data, type}) downloads a file in the browser
 * Anything else resolves to null, which the pages already handle ("not available in this view").
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var APP = (script && script.getAttribute('data-app')) || 'hub';
  var BASE = '/api/' + APP;

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function enc(s) { return encodeURIComponent(s); }

  function api(method, path, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(BASE + path, opt).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var e = new Error(t || ('HTTP ' + r.status)); e.code = r.status; throw e;
        });
      }
      return r.json();
    });
  }

  // ---- snapshots ----
  function docSnap(id, rec) {
    return {
      id: id, exists: !!rec,
      data: function () { return rec ? clone(rec.data) : undefined; },
      version: rec ? rec.version : 0
    };
  }
  function querySnap(list) {
    var docs = list.map(function (d) { return docSnap(d.id, d); });
    return { empty: docs.length === 0, size: docs.length, docs: docs, forEach: function (fn) { docs.forEach(fn); } };
  }

  // ---- queries (filtering is done here, in the page, on the whole collection) ----
  function matches(data, w) {
    var v = data[w[0]], op = w[1], x = w[2];
    switch (op) {
      case '==': case 'eq': return v === x;
      case '!=': case 'ne': return v !== x;
      case '<': case 'lt': return v < x;
      case '<=': case 'lte': return v <= x;
      case '>': case 'gt': return v > x;
      case '>=': case 'gte': return v >= x;
      case 'in': return Array.isArray(x) && x.indexOf(v) !== -1;
      case 'not-in': return Array.isArray(x) && x.indexOf(v) === -1;
      case 'array-contains': return Array.isArray(v) && v.indexOf(x) !== -1;
      default: return true;
    }
  }
  function applySpec(list, spec) {
    var out = list;
    if (spec.where && spec.where.length) out = out.filter(function (d) { return spec.where.every(function (w) { return matches(d.data, w); }); });
    if (spec.order) {
      var f = spec.order[0], dir = spec.order[1] === 'desc' ? -1 : 1;
      out = out.slice().sort(function (a, b) { var x = a.data[f], y = b.data[f]; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    }
    if (spec.lim) out = out.slice(0, spec.lim);
    return out;
  }

  // ---- ONE live connection for the whole page (browsers only allow a handful per server) ----
  // The page opens a single event stream, then tells the server which collections it wants. Every change to a watched
  // collection arrives as a fresh copy of that collection, which is handed to every listener on the page.
  var PAGE_ID = 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var live = {}, stream = null, streamOpen = false;
  function ensureStream() {
    if (stream || typeof EventSource === 'undefined') return;
    stream = new EventSource(BASE + '/stream?id=' + PAGE_ID);
    stream.addEventListener('snapshot', function (ev) {
      try { var m = JSON.parse(ev.data); var ch = live[m.c]; if (ch) ch.deliver(m.docs); } catch (e) {}
    });
    stream.onopen = function () {
      streamOpen = true;
      var names = Object.keys(live);
      if (names.length) api('POST', '/watch', { id: PAGE_ID, c: names }).catch(function () {});
    };
    stream.onerror = function () { streamOpen = false; };
  }
  function channel(name) {
    var ch = live[name];
    if (ch) return ch;
    ch = live[name] = { subs: [], last: null, gotFirst: false, started: false, poller: null };
    ch.deliver = function (docs) {
      ch.last = docs; ch.gotFirst = true;
      ch.subs.slice().forEach(function (s) { try { s.cb(docs); } catch (e) { if (window.console) console.error('snapshot callback', name, e); } });
    };
    function poll() {
      api('GET', '/c/' + enc(name)).then(function (r) { ch.deliver(r.docs); }, function (e) {
        ch.subs.slice().forEach(function (s) { if (s.err) { try { s.err(e); } catch (x) {} } });
      });
    }
    ch.start = function () {
      if (ch.started) return; ch.started = true;
      if (typeof EventSource === 'undefined') { poll(); ch.poller = setInterval(poll, 5000); return; }
      ensureStream();
      api('POST', '/watch', { id: PAGE_ID, c: [name] }).catch(function () {});
      // if nothing has arrived after a few seconds, read once so the page is not left waiting
      setTimeout(function () { if (!ch.gotFirst) poll(); }, 4000);
    };
    return ch;
  }
  function subscribe(name, spec, cb, err) {
    var ch = channel(name);
    var sub = { cb: function (docs) { cb(querySnap(applySpec(docs, spec || {}))); }, err: err };
    ch.subs.push(sub);
    if (ch.gotFirst) setTimeout(function () { if (ch.subs.indexOf(sub) !== -1) sub.cb(ch.last); }, 0);
    ch.start();
    return function () {
      var i = ch.subs.indexOf(sub); if (i !== -1) ch.subs.splice(i, 1);
    };
  }

  // ---- references ----
  function docRef(name, id) {
    var ref = {
      id: id, path: name + '/' + id,
      get: function () { return api('GET', '/c/' + enc(name) + '/' + enc(id)).then(function (r) { return docSnap(id, r.exists ? { data: r.data, version: r.version } : null); }); },
      set: function (data) { return api('PUT', '/c/' + enc(name) + '/' + enc(id), data).then(function () {}); },
      update: function (data) { return api('PATCH', '/c/' + enc(name) + '/' + enc(id), data).then(function () {}); },
      delete: function () { return api('DELETE', '/c/' + enc(name) + '/' + enc(id)).then(function () {}); },
      onSnapshot: function (cb, err) {
        return subscribe(name, null, function (snap) {
          var hit = snap.docs.filter(function (d) { return d.id === id; })[0];
          cb(hit || docSnap(id, null));
        }, err);
      }
    };
    return ref;
  }
  function query(name, spec) {
    var q = {
      where: function (f, op, v) { return query(name, { where: (spec.where || []).concat([[f, op, v]]), order: spec.order, lim: spec.lim }); },
      orderBy: function (f, dir) { return query(name, { where: spec.where, order: [f, dir || 'asc'], lim: spec.lim }); },
      limit: function (n) { return query(name, { where: spec.where, order: spec.order, lim: n }); },
      get: function () { return api('GET', '/c/' + enc(name)).then(function (r) { return querySnap(applySpec(r.docs, spec)); }); },
      onSnapshot: function (cb, err) { return subscribe(name, spec, cb, err); }
    };
    return q;
  }
  function collection(name) {
    var q = query(name, {});
    return {
      id: name,
      doc: function (id) { return docRef(name, id); },
      add: function (data) { return api('POST', '/c/' + enc(name), data).then(function (r) { return { id: r.id }; }); },
      get: q.get, where: q.where, orderBy: q.orderBy, limit: q.limit, onSnapshot: q.onSnapshot
    };
  }
  var db = {
    collection: collection,
    doc: function (path) { var p = String(path).split('/'); return docRef(p[0], p.slice(1).join('/')); }
  };

  var user = {
    canEdit: function () { return true; },
    isOwner: function () { return true; },
    id: function () { return 'local'; },
    me: function () { return { id: 'local' }; },
    profiles: function () { return Promise.resolve({}); },
    search: function () { return Promise.resolve([]); }
  };

  var downloads = {
    save: function (o) {
      return new Promise(function (resolve, reject) {
        try {
          var d = o.data, blob;
          if (d instanceof Blob) blob = d;
          else blob = new Blob([d], { type: o.type || o.contentType || 'application/octet-stream' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = o.filename || 'download';
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          resolve({ saved: true });
        } catch (e) { reject(e); }
      });
    }
  };

  window.claude = {
    use: function (name) {
      if (name === 'db') return Promise.resolve(db);
      if (name === 'user') return Promise.resolve(user);
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.resolve(null);
    },
    standalone: true
  };
})();
