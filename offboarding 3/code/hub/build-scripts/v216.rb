# encoding: utf-8
s = File.read('hub_v215.html', encoding: 'utf-8')
rep = lambda { |from, to| c = s.scan(from).size; abort("expected 1 got #{c}: #{from[0,100]}") unless c == 1; s.sub!(from) { to } }
rep.('        <button type="button" class="adv-subtab" data-sub="heatmap">Heat map</button>', '        <button type="button" class="adv-subtab" data-sub="heatmap">Heat map</button>' + "\n" + '        <button type="button" class="adv-subtab" data-sub="dashboard">Dashboard</button>')
panel = <<'HTML'
      <div class="adv-subpanel" id="advpage-subpanel-dashboard">
        <div id="dbd-root">
          <div class="dbd-head">
            <div><h3>Book of Business Overview</h3><p class="dbd-sub" id="dbd-sub">Live from the Hub</p></div>
            <label class="dbd-asof">As of <select id="dbd-asof" aria-label="Show the dashboard as of a month"></select></label>
          </div>
          <div class="dbd-tabs" role="tablist" aria-label="Dashboard sections">
            <button type="button" class="dbd-tab on" role="tab" data-tab="overview">Overview</button>
            <button type="button" class="dbd-tab" role="tab" data-tab="revenue">Revenue</button>
            <button type="button" class="dbd-tab" role="tab" data-tab="pipeline">Pipeline</button>
            <button type="button" class="dbd-tab" role="tab" data-tab="retention">Retention</button>
          </div>
          <div class="dbd-body" id="dbd-body"><div class="dbd-empty">Loading…</div></div>
        </div>
        <div id="dbd-tip"></div>
      </div>

HTML
rep.('      <div class="adv-subpanel" id="advpage-subpanel-capacity">', panel + '      <div class="adv-subpanel" id="advpage-subpanel-capacity">')
js = File.read('v216_dash.js', encoding: 'utf-8')
rep.("  // ---------- Advisors: the list of things an office can run.", js + "  // ---------- Advisors: the list of things an office can run.")
rep.("  .ae-run-item{", File.read('v216.css', encoding: 'utf-8') + "  .ae-run-item{")

# ---- Growth retention chart: same retention numbers as the Dashboard ----
gs = s.index("    function renderRanges(){\n      var ys = {}; timeline.forEach")
ge = s.index("    $('rt-ranges').addEventListener('click'")
seg = s[gs...ge]
seg.sub!("timeline.forEach(function(i){ ys[Math.floor(i / 12)] = 1; });") { "((window.hubRetention && window.hubRetention() || {}).series || []).forEach(function(p){ ys[Math.floor(p.idx / 12)] = 1; });" } or abort('g1')
seg.sub!("'aria-label': 'Line chart of the monthly retention rate'") { "'aria-label': 'Line chart of the retention rate'" } or abort('g2')
seg.sub!("var last = i === pts.length - 1, dip = p.lost.length > 0;") { "var last = i === pts.length - 1, dip = i > 0 && p.cancelled.length > pts[i - 1].cancelled.length;" } or abort('g3')
seg.sub!(/tip\.innerHTML = lab\(p\.idx\) \+ .*?\n.*?\n/m) { "tip.innerHTML = lab(p.idx) + '<br><b>' + Math.round(p.rate * 100) + '%</b> kept<br>' + p.kept + ' of ' + p.total + ' offices on the books' + (p.cancelled.length ? '<br>Cancelled so far: ' + p.cancelled.map(esc).join(', ') : '');\n" } or abort('g4')
rs = seg.index("    function render(){")
seg = seg[0...rs] + <<'JS'
    function render(){
      renderRanges();
      var S = window.hubRetention ? window.hubRetention() : null;
      var pts = S ? S.series.filter(function(p){ return range === 'all' || Math.floor(p.idx / 12) === +range; }) : [];
      if(!pts.length){ $('rt-stats').innerHTML = ''; renderChart([]); $('rt-list').innerHTML = ''; $('rt-how').textContent = 'This chart fills in once the billing year view has a few months of statuses.'; return; }
      var f = pts[pts.length - 1];
      $('rt-stats').innerHTML =
        '<div class="ac-stat"><b>' + Math.round(f.rate * 100) + '%</b><span>Retention &middot; ' + lab(f.idx, true) + '</span></div>' +
        '<div class="ac-stat"><b>' + f.kept + ' / ' + f.total + '</b><span>Offices not cancelled</span></div>' +
        '<div class="ac-stat"><b class="' + (f.cancelled.length ? 'down' : '') + '">' + f.cancelled.length + '</b><span>Cancelled</span></div>';
      renderChart(pts);
      $('rt-list').innerHTML = (S.cancelled.length ? '<span class="rt-list-title">Cancelled</span>' + S.cancelled.map(function(c){ return '<span class="rt-chip">' + esc(c.name) + (c.cancel != null ? '<b>' + lab(c.cancel, true) + '</b>' : '') + '</span>'; }).join('') : '<span class="rt-list-title">No cancelled offices</span>');
      $('rt-how').textContent = 'How it’s worked out: this is the same retention rate as Advisors > Dashboard. Of every office that has been on the books by that month, the share that haven’t cancelled, no matter when they cancelled. Coaching offices aren’t counted. An office that cancelled and came back counts as kept.';
    }
    window.addEventListener('hub-six-change', render);
JS
seg.sub!("this.textContent = o ? 'Hide cancelled & new' : 'Show cancelled & new';") { "this.textContent = o ? 'Hide the list' : 'Show who cancelled';" } or abort('g5')
s[gs...ge] = seg
rep.('id="rt-more" aria-expanded="false">Show cancelled &amp; new</button>', 'id="rt-more" aria-expanded="false">Show who cancelled</button>')

# ---- Goals: retention rate = the Dashboard's retention rate ----
rep.("hint: 'Of the offices active last December, the share that haven’t cancelled this year (Coaching offices aren\\u2019t counted).' }", "hint: 'The same retention rate as the Dashboard: of every office on the books, the share that haven\\u2019t cancelled, whenever they cancelled (Coaching offices aren\\u2019t counted).' }")
rep.("        var base = 0, kept = 0;\n        advisors.forEach(function(a){ if((a.runs || []).indexOf('coaching') !== -1) return; if(!activeAt(a.id, y - 1, 12)) return; base++; var c = false; for(var m = 1; m <= 12; m++) if(st(a.id, y, m) === 'cancelled') c = true; if(!c) kept++; });\n        return base ? Math.round(kept / base * 1000) / 10 : null;",
     "        var S = window.hubRetention ? window.hubRetention() : null; if(!S) return null;\n        var pts = S.series.filter(function(p){ return Math.floor(p.idx / 12) === y; });\n        return pts.length ? Math.round(pts[pts.length - 1].rate * 1000) / 10 : null;")
rep.("var now = new Date(), Y = now.getFullYear(), year = Y, goals = {}, advisors = [], billing = {}, spend = {}, col = null, editing = null;", "var now = new Date(), Y = now.getFullYear(), year = Y, goals = {}, advisors = [], billing = {}, spend = {}, col = null, editing = null;\n    window.addEventListener('hub-six-change', function(){ render(); });")

# ---- Advisor list: a clear Delete button (everyone who can edit), duplicate warning, and full clean-up ----
rep.('<th class="ae-mg">Fee ($)</th><th class="ae-mg">Fee w/ tax ($)</th><th class="ae-mg">Remove</th>', '<th class="ae-mg">Fee ($)</th><th class="ae-mg">Fee w/ tax ($)</th><th>Delete</th>')
rep.("    function rowHtml(id){\n      var d = drafts[id], mg = mgNow(), canc = !d.isNew && isCanc(id);", <<'JS'.chomp)
    // an office with several names is easy to add twice, so flag a likely duplicate while typing
    var DUP_WORDS = /\b(llc|inc|incorporated|the|group|financial|wealth|management|advisors|advisory|services|solutions|planners|planning|and|associates|co|company)\b/g;
    function dupBase(s){ return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(DUP_WORDS, ' ').replace(/[^a-z0-9]+/g, ''); }
    function dupOf(id){
      var me = drafts[id]; if(!me) return '';
      var b = dupBase(me.company), ae = trim(me.aecId);
      if(b.length < 4 && !ae) return '';
      var hit = '';
      Object.keys(drafts).some(function(o){
        if(o === id || drafts[o].remove) return false;
        var x = drafts[o], xb = dupBase(x.company);
        if((ae && trim(x.aecId) === ae) || (b.length >= 4 && xb.length >= 4 && (b === xb || (Math.min(b.length, xb.length) >= 5 && (b.indexOf(xb) === 0 || xb.indexOf(b) === 0))))){ hit = x.company; return true; }
        return false;
      });
      return hit;
    }
    function dupHtml(id){ var o = dupOf(id); return '<div class="ae-dup"' + (o ? '' : ' style="display:none"') + '>' + (o ? 'Looks like “' + esc(o) + '”, which is already in the list' : '') + '</div>'; }
    function rowHtml(id){
      var d = drafts[id], mg = mgNow(), canc = !d.isNew && isCanc(id);
JS
rep.("        '<td class=\"ae-co\"><input type=\"text\" data-f=\"company\" value=\"' + esc(d.company) + '\" placeholder=\"Company name\"></td>' +", "        '<td class=\"ae-co\"><input type=\"text\" data-f=\"company\" value=\"' + esc(d.company) + '\" placeholder=\"Company name\">' + dupHtml(id) + '</td>' +")
rep.("        '<td class=\"ae-mg ae-chk\"><input type=\"checkbox\" data-f=\"remove\"' + (d.remove ? ' checked' : '') + ' title=\"Remove this advisor\"></td>' +", "        '<td class=\"ae-del\"><button type=\"button\" class=\"ae-delbtn' + (d.remove ? ' on' : '') + '\" data-del=\"1\" title=\"Delete this office and its billing history\">' + (d.remove ? 'Undo delete' : 'Delete') + '</button></td>' +")
rep.("      if(e.target.closest('[data-addloc]'))", <<'JS'.chomp)
      var dl = e.target.closest('[data-del]');
      if(dl){
        if(d.isNew){ delete drafts[id]; tr.remove(); updateBar(); applyEditFilter(); return; }
        d.remove = !d.remove; dl.textContent = d.remove ? 'Undo delete' : 'Delete'; dl.classList.toggle('on', d.remove); markRow(tr);
        $('ae-body').querySelectorAll('tr').forEach(function(t2){ var dd = t2.querySelector('.ae-dup'); if(dd){ var o = dupOf(t2.dataset.id); dd.textContent = o ? 'Looks like “' + o + '”, which is already in the list' : ''; dd.style.display = o ? '' : 'none'; } });
        return;
      }
      if(e.target.closest('[data-addloc]'))
JS
rep.("      if(f === 'dma') tr.querySelector('.ae-podcell').innerHTML = podHtml(podOf(d.dma)) || dash();\n", "      if(f === 'dma') tr.querySelector('.ae-podcell').innerHTML = podHtml(podOf(d.dma)) || dash();\n      if(f === 'company' || f === 'aecId'){ var dd = tr.querySelector('.ae-dup'); if(dd){ var o = dupOf(id); dd.textContent = o ? 'Looks like “' + o + '”, which is already in the list' : ''; dd.style.display = o ? '' : 'none'; } }\n")
rep.("        if(d.remove){ if(mgNow()){ jobs.push(col.doc(id).delete().then(function(){ if(window.hubAdvisorRemoved) window.hubAdvisorRemoved(id); removed++; })); } return; }", "        if(d.remove){ jobs.push(col.doc(id).delete().then(function(){ if(window.hubAdvisorRemoved) window.hubAdvisorRemoved(id); removed++; })); return; }")
rep.("      $('ae-save').textContent = n ? 'Save changes (' + n + ')' : 'Save changes';", "      var rmN = Object.keys(drafts).filter(function(k){ return drafts[k].remove; }).length;\n      $('ae-save').textContent = n ? 'Save changes (' + n + ')' + (rmN ? ' · deletes ' + rmN : '') : 'Save changes';")
rep.("    window.hubAdvisorRemoved = function(id){\n      if(!blCol) return;", <<'JS'.chomp)
    window.hubAdvisorRemoved = function(id){
      // a deleted office takes its map settings, start month and monthly spend with it
      if(window.claude && window.claude.use) window.claude.use('db').then(function(db){
        if(!db) return;
        ['map_extras', 'contract_dates'].forEach(function(c){ db.collection(c).doc(id).delete().catch(function(){}); });
        db.collection('ad_spend').get().then(function(s){ s.docs.forEach(function(d){ var v = d.data() || {}; if(v.advisorId === id) db.collection('ad_spend').doc(d.id).delete().catch(function(){}); }); }).catch(function(){});
      }).catch(function(){});
      if(!blCol) return;
JS

# ---- Kudos board: keep every shoutout, newest month first (it used to hide everything before this month) ----
ks = s.index("        var thisMonth = snap.empty ? [] : snap.docs.map(function(doc){")
ke_marker = "}).join('');\n      }, function(){\n        disableKudos(\"Couldn't load shoutouts right now.\");"
ke = s.index(ke_marker, ks)
s[ks...ke + "}).join('');".length] = <<'JS'.chomp
        var all = snap.empty ? [] : snap.docs.map(function(doc){ return Object.assign({ id: doc.id }, doc.data() || {}); }).sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
        var thisMonth = all.filter(function(k){ return (k.ts || 0) >= monthStart; });
        renderKudosPeek(thisMonth, monthName);
        var card = function(k){
          var dateStr = k.ts ? new Date(k.ts).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '';
          return '<div class="kudos-card">' +
            '<div class="kudos-head"><b>'+escapeHtml(k.to)+'</b><span class="kudos-date">'+dateStr+'</span></div>' +
            '<div class="kudos-msg">'+escapeHtml(k.message)+'</div>' +
            '<div class="kudos-foot"><div class="kudos-from">— '+escapeHtml(k.from || 'Anonymous')+'</div>' + kudosClapHtml(k) + '</div>' +
          '</div>';
        };
        var html = '<div class="kudos-month-head"><b>' + monthName + ' shoutouts</b>' + (thisMonth.length ? '<span>' + thisMonth.length + ' so far</span>' : '') + '</div>' +
          (thisMonth.length ? thisMonth.map(card).join('') : '<div class="adv-office-empty">No shoutouts yet this month — be the first!</div>');
        var groups = [], byKey = {};
        all.filter(function(k){ return (k.ts || 0) < monthStart; }).forEach(function(k){
          var d = new Date(k.ts || 0), key = d.getFullYear() + '-' + d.getMonth();
          if(!byKey[key]){ byKey[key] = { label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), list: [] }; groups.push(byKey[key]); }
          byKey[key].list.push(k);
        });
        groups.forEach(function(g){ html += '<div class="kudos-month-head"><b>' + g.label + '</b><span>' + g.list.length + '</span></div>' + g.list.map(card).join(''); });
        kudosList.innerHTML = html;
JS
rep.("kudosCol.orderBy('ts', 'desc').limit(50).onSnapshot(", "kudosCol.onSnapshot(")

# ---- Goals: show every year's goals together (an "All years" view, on by default) ----
rep.('id="gl-next" aria-label="Next year">&#8250;</button></div>', 'id="gl-next" aria-label="Next year">&#8250;</button><button type="button" class="gl-allbtn on" id="gl-all" aria-pressed="true">All years</button></div>')
rep.("      var cur = g.metric === 'custom' ? (typeof g.current === 'number' ? g.current : null) : compute(g.metric, year);\n      var s = status(g, cur), hide", "      var cur = g.metric === 'custom' ? (typeof g.current === 'number' ? g.current : null) : compute(g.metric, g.year || year);\n      var s = status(g, cur), hide")
rep.("    function render(){\n      $('gl-year').textContent = year;\n      $('gl-add').style.display = (mg() && col) ? '' : 'none';\n", <<'JS'.chomp)
    var showAll = true;
    function renderAll(){
      var ids = Object.keys(goals).sort(function(a, b){ return (goals[a].year || 0) - (goals[b].year || 0) || (goals[a].ts || 0) - (goals[b].ts || 0); });
      var years = []; ids.forEach(function(id){ var y = goals[id].year; if(years.indexOf(y) === -1) years.push(y); });
      $('gl-year').textContent = 'All years';
      $('gl-all').classList.add('on'); $('gl-all').setAttribute('aria-pressed', 'true');
      $('gl-add').style.display = (mg() && col) ? '' : 'none';
      if(!ids.length){ listEl.innerHTML = '<div class="gl-empty">' + (mg() ? 'No goals yet. Click “+ Add a goal” to set the first one.' : 'No goals have been set yet. Management adds them here.') + '</div>'; $('gl-sum').textContent = ''; return; }
      var hit = 0; ids.forEach(function(id){ var g = goals[id]; if((METRICS[g.metric] || {}).mgOnly && !mg()) return; var cur = g.metric === 'custom' ? (typeof g.current === 'number' ? g.current : null) : compute(g.metric, g.year); if(status(g, cur).cls === 'good') hit++; });
      $('gl-sum').textContent = hit + ' of ' + ids.length + ' goals on target or reached';
      listEl.innerHTML = years.map(function(y){ return '<div class="gl-yearhead"><b>' + esc(y) + '</b><span>' + (y > Y ? 'upcoming' : y === Y ? 'this year' : 'past year') + '</span></div>' + ids.filter(function(id){ return goals[id].year === y; }).map(function(id){ return cardHtml(id, goals[id]); }).join(''); }).join('');
    }
    function render(){
      if(showAll){ renderAll(); return; }
      $('gl-all').classList.remove('on'); $('gl-all').setAttribute('aria-pressed', 'false');
      $('gl-year').textContent = year;
      $('gl-add').style.display = (mg() && col) ? '' : 'none';
JS
rep.("    $('gl-prev').addEventListener('click', function(){ year--; render(); });\n    $('gl-next').addEventListener('click', function(){ year++; render(); });", "    $('gl-prev').addEventListener('click', function(){ if(showAll) showAll = false; else year--; render(); });\n    $('gl-next').addEventListener('click', function(){ if(showAll) showAll = false; else year++; render(); });\n    $('gl-all').addEventListener('click', function(){ showAll = !showAll; render(); });")

# ---- Goals: a goal for a future year tracks where we are now ----
rep.("        if(y === Y) return counted.filter(function(a){ return !isCanc(a.id); }).length;", "        if(y >= Y) return counted.filter(function(a){ return !isCanc(a.id); }).length;")
rep.("var mm = y === Y ? now.getMonth() + 1 : y < Y ? 12 : null; if(mm == null) return null;", "var yy = y > Y ? Y : y, mm = yy === Y ? now.getMonth() + 1 : 12; while(mm > 1 && advisors.filter(function(a){ var v0 = st(a.id, yy, mm); return v0 && v0 !== 'na'; }).length < 3) mm--;")
rep.("var v = st(a.id, y, mm); if(!v || v === 'cancelled'", "var v = st(a.id, yy, mm); if(!v || v === 'cancelled'")
rep.("var sd = spend[y + '-' + (mm < 10", "var sd = spend[yy + '-' + (mm < 10")

# ---- One shared live connection per collection (the page had ~73 duplicate listeners, and the last ones, like Kudos, were failing) ----
shared_js = <<'JS'
<script>
// Every part of the Hub asks for the same few collections (advisors, billing, capacity...). Instead of each one opening its own live
// connection, they all share one per collection. window.hubDb() works like claude.use('db').
(function(){
  var wrapped = null, entries = {};
  function subscribe(name, real, cb, errCb){
    var e = entries[name] || (entries[name] = { subs: [], last: null, hasLast: false, unsub: null }), sub = { cb: cb, err: errCb };
    e.subs.push(sub);
    if(!e.unsub){
      e.unsub = real.onSnapshot(function(snap){
        e.last = snap; e.hasLast = true;
        e.subs.slice().forEach(function(s){ try{ s.cb(snap); }catch(x){ if(window.console) console.error('snapshot callback', name, x); } });
      }, function(err){
        e.subs.slice().forEach(function(s){ if(s.err){ try{ s.err(err); }catch(x){} } });
      });
    } else if(e.hasLast){
      setTimeout(function(){ if(e.subs.indexOf(sub) !== -1){ try{ cb(e.last); }catch(x){ if(window.console) console.error('snapshot callback', name, x); } } }, 0);
    }
    return function(){
      var i = e.subs.indexOf(sub); if(i !== -1) e.subs.splice(i, 1);
      if(!e.subs.length && e.unsub){ try{ e.unsub(); }catch(x){} e.unsub = null; e.hasLast = false; e.last = null; }
    };
  }
  // The runtime hands out frozen objects, so a Proxy can't change them. Build plain wrapper objects that forward everything instead.
  function forward(target, over){
    var o = {}, seen = {};
    function take(k){ if(seen[k] || k === 'constructor') return; seen[k] = 1; try{ var v = target[k]; o[k] = typeof v === 'function' ? v.bind(target) : v; }catch(x){} }
    for(var k in target) take(k);
    Object.getOwnPropertyNames(target).forEach(take);
    var proto = Object.getPrototypeOf(target);
    if(proto && proto !== Object.prototype) Object.getOwnPropertyNames(proto).forEach(take);
    Object.keys(over).forEach(function(k){ o[k] = over[k]; });
    return o;
  }
  var cols = {};
  function wrapCol(name, real){
    return forward(real, { onSnapshot: function(cb, errCb){ return subscribe(name, real, cb, errCb); } });
  }
  function wrap(db){
    try{
      var w = forward(db, { collection: function(name){ return wrapCol(name, db.collection(name)); } });
      var probe = w.collection('__probe__');
      if(typeof probe.onSnapshot !== 'function' || typeof probe.doc !== 'function') return db;
      return w;
    }catch(x){ return db; }
  }
  window.hubDb = function(){
    if(!(window.claude && window.claude.use)) return Promise.resolve(null);
    return window.claude.use('db').then(function(db){ if(!db) return db; if(!wrapped || wrapped.raw !== db) wrapped = { raw: db, db: wrap(db) }; return wrapped.db; });
  };
})();
</script>
JS
s.gsub!("window.claude.use('db')", "window.hubDb()")
s.gsub!("claude.use('db')", "window.hubDb()")
i = s.index('<script') or abort('noscript')
s[i...i] = shared_js

# ---- Advisors password screen: never hide the box; check the password list on demand if the live connection is slow or fails ----
rep.("$('adv-gate-form').style.display = (hashes === null || none) ? 'none' : '';", "$('adv-gate-form').style.display = none ? 'none' : '';")
rep.("hashes === null ? 'Checking…' :", "hashes === null ? 'Enter the password for your team to open this page.' :")
gs = s.index("    $('adv-gate-go').addEventListener('click', function(){\n      var pw = $('adv-gate-pw').value; if(!pw || !hashes) return;")
ge = s.index("    $('adv-gate-pw').addEventListener('keydown'", gs)
s[gs...ge] = <<'JS'
    function readHashes(snapDoc){ var v = (snapDoc && snapDoc.exists !== false && snapDoc.data) ? (snapDoc.data() || {}) : {}; hashes = { onboarding: v.onboarding || '', internal: v.internal || '', updatedBy: v.updatedBy, updatedAt: v.updatedAt }; }
    // if the live list hasn't arrived (or failed), read it straight from the database when someone presses Enter
    function ensureHashes(){
      if(hashes) return Promise.resolve();
      if(!col) return Promise.resolve();
      return col.doc('advisors').get().then(function(d){ readHashes(d); apply(); }, function(err){ $('adv-gate-msg').textContent = 'Couldn’t reach the password list (' + ((err && (err.code || err.message)) || 'error') + '). Check your connection and try again.'; });
    }
    $('adv-gate-go').addEventListener('click', function(){
      var pw = $('adv-gate-pw').value; if(!pw) return;
      ensureHashes().then(function(){
        if(!hashes) return;
        sha(pw).then(function(h){
          var l = (hashes.internal && h === hashes.internal) ? 'internal' : (hashes.onboarding && h === hashes.onboarding) ? 'onboarding' : null;
          if(!l){ $('adv-gate-msg').textContent = 'That password isn’t right.'; $('adv-gate-pw').select(); return; }
          try{ sessionStorage.setItem(KEY, JSON.stringify({ l: l, h: h })); }catch(e){}
          $('adv-gate-pw').value = ''; apply(); if(window.hubRenderAdvisors) window.hubRenderAdvisors();
        });
      });
    });
JS
rep.("      }, function(){ hashes = {}; apply(); });\n    });\n  })();\n\n  // ---------- Shared helper: a small searchable checklist", "      }, function(){ col.doc('advisors').get().then(function(d){ readHashes(d); apply(); }, function(){ apply(); }); });\n    });\n  })();\n\n  // ---------- Shared helper: a small searchable checklist")

# ---- Kudos: if the live connection fails, read once; show the real reason if that fails too ----
rep.("      kudosCol.onSnapshot(function(snap){\n        var now = new Date(), monthStart", "      var onKudos = function(snap){\n        var now = new Date(), monthStart")
rep.("        kudosList.innerHTML = html;\n      }, function(){\n        disableKudos(\"Couldn't load shoutouts right now.\");\n      });", "        kudosList.innerHTML = html;\n      };\n      kudosCol.onSnapshot(onKudos, function(err){ kudosCol.get().then(onKudos, function(e2){ disableKudos(\"Couldn't load shoutouts right now (\" + ((e2 && (e2.code || e2.message)) || (err && (err.code || err.message)) || 'unknown reason') + \").\"); }); });")
s.sub!(/HUB_BUILD = \d+/) { "HUB_BUILD = #{(Time.now.to_f*1000).to_i}" } or abort('f')
File.write('hub_v231.html', s)
t = s.sub("<script") { "<script src=\"mock.js?v=112\"></script><script" }
File.write('prev/index.html', t); puts "ok #{s.size}"
