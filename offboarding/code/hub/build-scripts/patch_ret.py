p='v216_dash.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:80],s.count(a)); s=s.replace(a,b)
def cut(a,b,new):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+new+s[j:]

rep("firstIdx = {}, cancelIdx = {};\n    var asOf","firstIdx = {}, cancelIdx = {}, startedAt = {}, churnAt = {};\n    var asOf")
rep("st = {}; timeline = []; activeAt = {}; newsAt = {}; lostAt = {}; firstIdx = {}; cancelIdx = {};","st = {}; timeline = []; activeAt = {}; newsAt = {}; lostAt = {}; firstIdx = {}; cancelIdx = {}; startedAt = {}; churnAt = {};")
rep("        activeAt[idx] = act; newsAt[idx] = news; lostAt[idx] = lost;","        activeAt[idx] = act; newsAt[idx] = news; lostAt[idx] = lost;\n        startedAt[idx] = ids.filter(function(id){ return state[id].s && !advisors[id].coaching; });\n        churnAt[idx] = ids.filter(function(id){ return state[id].s && state[id].c && !advisors[id].coaching; });")

cut("    function retention(nowIdx){","    // ----- drawing -----", r"""    // Retention = of every office we have had on the books (coaching offices aren't counted), the share that haven't cancelled, whenever they cancelled.
    function retAt(M){ var total = (startedAt[M] || []).length, gone = (churnAt[M] || []).length; return { total: total, kept: total - gone, gone: gone, rate: total ? (total - gone) / total : null }; }
    function quarters(){
      var y = Math.floor(asOf / 12), out = [];
      for(var q = 1; q <= 4; q++){
        var a = y * 12 + (q - 1) * 3, b = a + 2;
        if(a > asOf){ out.push({ q: q, rate: null, base: 0, lost: 0 }); continue; }
        var base = (activeAt[Math.max(a - 1, timeline[0])] || []), set = {}; base.forEach(function(id){ set[id] = 1; });
        var lostIds = []; for(var i = a; i <= Math.min(b, asOf); i++) (lostAt[i] || []).forEach(function(id){ if(set[id] && lostIds.indexOf(id) === -1) lostIds.push(id); });
        out.push({ q: q, base: base.length, lost: lostIds.length, rate: base.length ? (base.length - lostIds.length) / base.length : null, partial: b > asOf });
      }
      return out;
    }
    function officeRows(){
      var now = asOf, out = [];
      Object.keys(advisors).forEach(function(id){
        var f = firstIdx[id], sm = st[id] || {}, rawCancel = null;
        Object.keys(sm).map(Number).sort(function(x, y){ return x - y; }).some(function(i){ if(sm[i] === 'cancelled'){ rawCancel = i; return true; } return false; });
        if(f == null && rawCancel == null) return;
        var ci = cancelIdx[id] != null ? cancelIdx[id] : rawCancel, back = ci != null && Object.keys(sm).some(function(i){ return +i > ci && ACTIVE[sm[i]]; });
        var churned = advisors[id].coaching ? (ci != null && ci <= now && !back) : (churnAt[now] || []).indexOf(id) !== -1;
        var ent = ymToIdx((dates[id] || {}).start), start = ent != null ? ent : f;
        var cls = churned ? 'CANCELLED' : (ci != null && ci <= now && f != null) ? 'CAME BACK' : f == null ? 'CANCELLED' : 'RETAINED';
        out.push({ id: id, name: company(id), coaching: !!advisors[id].coaching, cls: cls, start: start, entered: ent != null, cancel: ci, onboarding: !churned && start != null && (ent != null || f > timeline[0]) && start + 6 > now });
      });
      return out;
    }

""")
rep("      var rr = rate(ret), q = [1, 2, 3, 4].map(function(n){ return rate(ret.filter(function(o){ return o.q === n; })); });\n","      var rr = retAt(asOf), q = quarters();\n")
rep("var qBody = q.map(function(x, i){ return 'Q' + (i + 1) + '::' + (x.rate == null ? 'no cohort yet' : pct(x.rate)); }).join('||');","var qBody = q.map(function(x){ return 'Q' + x.q + '::' + (x.rate == null ? 'not started' : pct(x.rate)); }).join('||');")
rep("tip('6-Month Retention', 'Overall', qBody, pct(rr.rate), 'Retention')","tip('Retention Rate', 'Overall', qBody, pct(rr.rate), 'Retained')")
rep("'</span><span class=\"dbd-ks\">' + (rr.r + rr.d) + ' offices counted' + (ret.filter(function(o){ return o.cls === 'REVIEW'; }).length ? ' \\u00b7 add start months on the Retention tab' : '') + '</span></div>' +","'</span><span class=\"dbd-ks\">' + rr.kept + ' of ' + rr.total + ' offices haven\\u2019t cancelled</span></div>' +")
rep("q.map(function(x, i){ var cls = x.rate == null ? 'is-pending' : x.rate >= 0.9 ? 'is-good' : 'is-warn'; return '<div class=\"dbd-q ' + cls + ' has-tip\"' + tip('Q' + (i + 1) + ' ' + Math.floor(asOf / 12), '', 'Renewed::' + x.r + '||Did not renew::' + x.d, x.rate == null ? '—' : pct(x.rate), 'Retention') + '><span class=\"dbd-ql\">Q' + (i + 1) + '</span>",
    "q.map(function(x){ var cls = x.rate == null ? 'is-pending' : x.rate >= 0.9 ? 'is-good' : 'is-warn'; return '<div class=\"dbd-q ' + cls + ' has-tip\"' + tip('Q' + x.q + ' ' + Math.floor(asOf / 12), x.partial && x.rate != null ? 'So far' : '', 'On the books at the start::' + x.base + '||Cancelled::' + x.lost, x.rate == null ? '\\u2014' : pct(x.rate), 'Retained') + '><span class=\"dbd-ql\">Q' + x.q + '</span>")
rep("    function drawOverview(ret){","    function drawOverview(rows){")
rep("    function drawPipeline(ret){","    function drawPipeline(rows){")
rep("onb = ret.filter(function(o){ return o.cls === 'PENDING' && o.currentlyActive; }).length;","onb = rows.filter(function(o){ return o.onboarding && !o.coaching; }).length;")
cut("    function drawRetention(ret, retAll){","    function render(){", r"""    function drawRetention(rows){
      var rr = retAt(asOf), qs = quarters(), real = rows.filter(function(o){ return !o.coaching; }), back = real.filter(function(o){ return o.cls === 'CAME BACK'; }).length;
      var h = '<p class="dbd-intro">Retention = of every office we have had on the books, the share that haven’t cancelled, no matter when they cancelled. An office that cancelled and later came back counts as kept. Coaching offices are shown in grey for reference and aren’t counted anywhere.</p><div class="dbd-grid">' +
        '<div class="dbd-card is-accent span-4"><span class="dbd-kl">Retention Rate</span><span class="dbd-kv">' + pct(rr.rate) + '</span><span class="dbd-ks">' + rr.kept + ' of ' + rr.total + ' offices haven’t cancelled</span></div>' +
        '<div class="dbd-card span-4"><span class="dbd-kl">Cancelled</span><span class="dbd-kv">' + rr.gone + '</span><span class="dbd-ks">offices that cancelled</span></div>' +
        '<div class="dbd-card span-4"><span class="dbd-kl">Offices on the Books</span><span class="dbd-kv">' + rr.total + '</span><span class="dbd-ks">ever active' + (back ? ' · ' + back + ' came back after cancelling' : '') + '</span></div></div>';
      h += '<div class="dbd-card"><p class="dbd-sh">Retention by Quarter <small>of the offices on the books at the start of the quarter, the share that didn’t cancel in it</small></p><div class="dbd-qgrid">' + qs.map(function(x){ var cls = x.rate == null ? 'is-pending' : x.rate >= 0.9 ? 'is-good' : 'is-warn'; return '<div class="dbd-q ' + cls + '"><span class="dbd-ql">Q' + x.q + '</span><span class="dbd-qv">' + (x.rate == null ? '—' : pct(x.rate)) + '</span><small>' + (x.base ? (x.base - x.lost) + ' of ' + x.base + ' kept' + (x.partial ? ' so far' : '') : 'not started') + '</small></div>'; }).join('') + '</div></div>';
      var F = [['ALL', 'All'], ['RETAINED', 'Retained'], ['CANCELLED', 'Cancelled'], ['COACHING', 'Coaching (not counted)']];
      var gone = function(o){ return o.cls === 'CANCELLED' ? 1 : 0; };
      var list = rows.filter(function(o){ return retFilter === 'ALL' || (retFilter === 'COACHING' ? o.coaching : !o.coaching && (retFilter === 'RETAINED' ? o.cls !== 'CANCELLED' : o.cls === 'CANCELLED')); }).sort(function(a, b){ return gone(a) - gone(b) || a.name.localeCompare(b.name); });
      var tag = function(o){ return (o.coaching ? '<span class="dbd-tag coach">Coaching · not counted</span> ' : '') + (o.cls === 'CANCELLED' ? '<span class="dbd-tag dnr">Cancelled</span>' : o.cls === 'CAME BACK' ? '<span class="dbd-tag pending">Cancelled, came back</span>' : o.coaching ? '' : '<span class="dbd-tag renewed">Retained</span>'); };
      h += '<div class="dbd-card"><p class="dbd-sh">Retention by Office <small>cancelled offices sit at the bottom</small></p><div class="dbd-filter">' + F.map(function(f){ return '<button type="button" class="dbd-fb' + (retFilter === f[0] ? ' on' : '') + '" data-rf="' + esc(f[0]) + '">' + esc(f[1]) + '</button>'; }).join('') + '</div><div class="dbd-twrap"><table class="dbd-table dbd-rt"><thead><tr><th>Office</th><th>Start month</th><th>Source</th><th>Cancelled</th><th>Status</th></tr></thead><tbody>' +
        (list.map(function(o){ var ed = canEdit(), cl = (o.coaching ? 'dbd-coach' : '') + (o.cls === 'CANCELLED' ? ' dbd-gone' : '');
          return '<tr' + (cl.trim() ? ' class="' + cl.trim() + '"' : '') + '><td><b>' + esc(o.name) + '</b></td><td>' + (ed ? '<input type="month" class="dbd-month" data-start="' + esc(o.id) + '" value="' + (o.start != null ? idxToYm(o.start) : '') + '">' : (o.start != null ? esc(idxLabel(o.start)) : '—')) + '</td><td class="' + (o.entered ? '' : 'dbd-inf') + '">' + (o.entered ? 'Entered' : o.start == null ? '—' : 'First billed month') + '</td><td>' + (o.cancel != null ? esc(idxLabel(o.cancel)) : '—') + '</td><td>' + tag(o) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="dbd-empty">No offices in this view.</td></tr>') + '</tbody></table></div>' +
        '<p class="dbd-note">The start month isn’t used for the retention rate. It only feeds the Onboarding count on the Pipeline tab (offices under 6 months in). An entered date wins over the first billed month.</p></div>';
      return h;
    }

""")
rep("var retAll = retention(), ret = retAll.filter(function(o){ return !o.coaching; }), body = {","var rows = officeRows(), body = {")
rep("}[tab](ret, retAll);","}[tab](rows);")
cut("    // the Growth retention chart reads the same numbers","    function later(){ if(queued)", r"""    // the Growth retention chart reads the same numbers: the share of offices on the books, by month, that haven't cancelled
    window.hubRetention = function(){
      if(!timeline.length) return null;
      var last = timeline[timeline.length - 1], series = [];
      timeline.forEach(function(idx){ var r = retAt(idx); if(r.total) series.push({ idx: idx, rate: r.rate, kept: r.kept, total: r.total, cancelled: (churnAt[idx] || []).map(company) }); });
      var rows = officeRows().filter(function(o){ return !o.coaching; });
      return { series: series, last: last, overall: retAt(last), cancelled: rows.filter(function(o){ return o.cls === 'CANCELLED'; }).map(function(o){ return { name: o.name, cancel: o.cancel }; }) };
    };
""")
open(p,'w',encoding='utf-8').write(s)
