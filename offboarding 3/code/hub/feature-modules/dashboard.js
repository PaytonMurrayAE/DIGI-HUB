  // ---------- Advisors > Dashboard: the Book of Business overview (Overview, Capacity, Revenue, Pipeline, Retention), worked out
  // live from the Hub's own data: advisors, the billing year view, capacity, monthly spend and advisor counts. Two small extras live in
  // db: "contract_dates" (one doc per advisor: {start:"YYYY-MM"}, for the 6-month retention) and "waitlist" (offices waiting to start). ----------
  (function(){
    var root = document.getElementById('dbd-root');
    if(!root) return;
    var $ = function(id){ return document.getElementById(id); };
    var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var ACTIVE = { yes: 1, no: 1, comp: 1, 'new': 1 };
    var advisors = {}, billing = {}, caps = {}, spend = {}, counts = {}, dates = {}, waits = {}, settings = {}, datesCol = null, waitCol = null, setCol = null;
    var st = {}, timeline = [], activeAt = {}, newsAt = {}, lostAt = {}, firstIdx = {}, cancelIdx = {}, startedAt = {}, churnAt = {};
    var asOf = null, tab = 'overview', retFilter = 'ALL', queued = false;
    var idxLabel = function(i, long){ var y = Math.floor(i / 12), m = i % 12; return (long ? LONG[m] : MON[m]) + ' ' + y; };
    var pct = function(v, dp){ return v == null ? '—' : (v * 100).toFixed(dp || 0) + '%'; };
    var usd = function(v){ return v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US'); };
    var num = function(v, dp){ return v == null ? '—' : (Math.round(v * Math.pow(10, dp || 0)) / Math.pow(10, dp || 0)).toString(); };
    var mgNow = function(){ return (typeof mgmtUnlocked !== 'undefined') && mgmtUnlocked; };
    var canEdit = function(){ if(mgNow()) return true; var a = window.hubAdvAccess ? window.hubAdvAccess() : null; return a === 'internal'; };
    var ymToIdx = function(s){ var m = /^(\d{4})-(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 12 + (+m[2]) - 1 : null; };
    var idxToYm = function(i){ var y = Math.floor(i / 12), m = i % 12 + 1; return y + '-' + (m < 10 ? '0' : '') + m; };
    var company = function(id){ return advisors[id] ? advisors[id].company : id; };

    // ----- the numbers -----
    function compute(){
      st = {}; timeline = []; activeAt = {}; newsAt = {}; lostAt = {}; firstIdx = {}; cancelIdx = {}; startedAt = {}; churnAt = {};
      var ids = Object.keys(advisors), count = {}, withAny = {};
      Object.keys(billing).forEach(function(k){
        var d = billing[k]; if(!d || !advisors[d.advisorId]) return;
        for(var m = 1; m <= 12; m++){ var v = d['m' + m]; if(!v) continue; var i = (d.year || 0) * 12 + m - 1; (st[d.advisorId] = st[d.advisorId] || {})[i] = v; if(!advisors[d.advisorId].coaching){ count[i] = (count[i] || 0) + 1; withAny[d.advisorId] = 1; } }
      });
      var keys = Object.keys(count).map(Number).sort(function(a, b){ return a - b; });
      var need = Math.max(3, Math.ceil(Object.keys(withAny).length * 0.5));
      var good = keys.filter(function(i){ return count[i] >= need; });
      if(!good.length) return;
      for(var i = good[0]; i <= good[good.length - 1]; i++) timeline.push(i);
      var state = {}; ids.forEach(function(id){ state[id] = { s: false, c: false }; });
      timeline.forEach(function(idx, n){
        var lost = [], news = [], act = [];
        ids.forEach(function(id){
          var s = state[id], v = (st[id] || {})[idx], co = advisors[id].coaching;
          if(s.s && !s.c && v === 'cancelled'){ if(!co) lost.push(id); if(cancelIdx[id] == null) cancelIdx[id] = idx; }
          if(ACTIVE[v]){ if(!s.s){ if(n > 0 && !co) news.push(id); } s.s = true; s.c = false; if(firstIdx[id] == null) firstIdx[id] = idx; }
          else if(v === 'cancelled'){ s.c = true; }
          if(s.s && !s.c && !co) act.push(id);
        });
        activeAt[idx] = act; newsAt[idx] = news; lostAt[idx] = lost;
        startedAt[idx] = ids.filter(function(id){ return state[id].s && !advisors[id].coaching; });
        churnAt[idx] = ids.filter(function(id){ return state[id].s && state[id].c && !advisors[id].coaching; });
      });
      if(asOf == null || timeline.indexOf(asOf) === -1) asOf = timeline[timeline.length - 1];
    }
    // an office's billing status in a month; unmarked months carry the last marked one
    function statusAt(id, idx){
      var s = st[id] || {}, v = s[idx];
      if(ACTIVE[v]) return v;
      for(var i = idx - 1; i >= timeline[0]; i--){ if(ACTIVE[s[i]]) return s[i]; if(s[i] === 'cancelled') return null; }
      return null;
    }
    function monthSpend(idx){
      var y = Math.floor(idx / 12), m = idx % 12 + 1, p = y + '-' + (m < 10 ? '0' : '') + m + '_', t = 0, any = false;
      Object.keys(spend).forEach(function(k){ if(k.indexOf(p) !== 0) return; var d = spend[k] || {}; if(!advisors[d.advisorId] || advisors[d.advisorId].coaching) return; any = true; var cp = Array.isArray(d.comp) ? d.comp : []; ['hnw', 'hvo', 'event', 'other'].forEach(function(c){ if(cp.indexOf(c) === -1) t += +d[c] || 0; }); });
      return any ? t : null;
    }
    // management fees for a month, same rules as the Goals page: an entered fee on Monthly spend wins over the card's fee; comped fees are kept apart
    function monthFees(idx, ids){
      var y = Math.floor(idx / 12), m = idx % 12 + 1, p = y + '-' + (m < 10 ? '0' : '') + m + '_', out = { charged: 0, comp: 0, noFee: 0 };
      ids.forEach(function(id){
        var sd = spend[p + id] || {}, fee = typeof sd.fee === 'number' ? sd.fee : advisors[id].mgmtFee;
        if(fee == null){ out.noFee++; return; }
        var v = statusAt(id, idx);
        if(v === 'comp' || (Array.isArray(sd.comp) && sd.comp.indexOf('fee') !== -1)) out.comp += fee; else out.charged += fee;
      });
      return out;
    }
    function people(){
      var by = {};
      Object.keys(caps).forEach(function(id){ var c = caps[id]; if(c && c.name) by[c.name] = { name: c.name, pod: c.pod || '', capacity: typeof c.capacity === 'number' ? c.capacity : null, extra: +c.extra || 0, hrs: 0, offices: 0 }; });
      (activeAt[asOf] || []).forEach(function(id){ var a = advisors[id], p = by[a.dma]; if(p){ p.hrs += a.hours || 0; p.offices++; } });
      return Object.keys(by).map(function(n){ var p = by[n]; p.load = p.hrs + p.extra; p.util = p.capacity > 0 ? p.load / p.capacity : null; var t = (typeof team !== 'undefined') ? team.filter(function(x){ return x.name === n; })[0] : null; p.title = t && t.title ? t.title.replace(/^Digital Marketing\s+/, '') : ''; return p; }).filter(function(p){ return p.capacity != null && p.capacity > 0; }).sort(function(a, b){ return (b.util || 0) - (a.util || 0); });
    }
    // Retention = of every office we have had on the books (coaching offices aren't counted), the share that haven't cancelled, whenever they cancelled.
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

    // ----- drawing -----
    var tip = function(title, tag, body, value, label){ return ' tabindex="0" data-tip-title="' + esc(title) + '"' + (tag ? ' data-tip-tag="' + esc(tag) + '"' : '') + (body ? ' data-tip-body="' + esc(body) + '"' : '') + (value != null ? ' data-tip-value="' + esc(value) + '" data-tip-value-label="' + esc(label || '') + '"' : ''); };
    function drawOverview(rows){
      var act = activeAt[asOf] || [], mixN = { c: 0, n: 0, p: 0 }, lost = (lostAt[asOf] || []).length;
      act.forEach(function(id){ var v = statusAt(id, asOf); if(v === 'no') mixN.n++; else if(v === 'comp') mixN.p++; else mixN.c++; });
      var tot = act.length + lost, w = function(n){ return tot ? (n / tot * 100) : 0; };
      var cap = people(), over = cap.filter(function(p){ return p.util > 1; });
      var rr = retAt(asOf), q = quarters();
      var qBody = q.map(function(x){ return 'Q' + x.q + '::' + (x.rate == null ? 'not started' : pct(x.rate)); }).join('||');
      var h = '<div class="dbd-grid">' +
        '<div class="dbd-card is-accent span-4 has-tip"' + tip('Retention Rate', 'Overall', qBody, pct(rr.rate), 'Retained') + '><span class="dbd-kl">Retention Rate</span><span class="dbd-kv">' + pct(rr.rate) + '</span><span class="dbd-ks">' + rr.kept + ' of ' + rr.total + ' offices haven\u2019t cancelled</span></div>' +
        '<div class="dbd-card span-4 has-tip"' + tip('DMAs at Capacity', 'Over 100% booked', over.map(function(p){ return p.name + '::' + pct(p.util) + ' (' + num(p.load, 1) + ' of ' + num(p.capacity, 1) + ' hrs)'; }).join('||') || 'Status::No one is over 100%', String(over.length), 'People') + '><span class="dbd-kl">DMAs at Capacity</span><span class="dbd-kv">' + over.length + '</span><span class="dbd-ks ' + (over.length ? 'is-warn' : '') + '">' + (over.length === 0 ? 'everyone is within capacity' : over.length === 1 ? esc(over[0].name) + ' is over capacity' : over.length + ' people are over capacity') + '</span></div>' +
        '<div class="dbd-card span-4 has-tip"' + tip('Active Book', idxLabel(asOf), 'Charged::' + mixN.c + '||No charge::' + mixN.n + '||Comped::' + mixN.p, String(act.length), 'Active offices') + '><span class="dbd-kl">Active Book</span><span class="dbd-kv">' + act.length + '</span><span class="dbd-ks">offices active</span></div></div>';
      h += '<div class="dbd-grid"><div class="dbd-card span-12"><p class="dbd-sh"># of Advisors <small>' + idxLabel(timeline[0]) + ' – ' + idxLabel(asOf) + ' · hover a point</small></p>' + trendSvg() + '</div></div>';
      h += '<div class="dbd-grid"><div class="dbd-card span-6"><p class="dbd-sh">Billing Status Mix <small>' + idxLabel(asOf, true) + '</small></p><div class="dbd-seg" role="img" aria-label="Billing status mix">' +
        '<span style="width:' + w(mixN.c) + '%;background:var(--dbd-good)"></span><span style="width:' + w(mixN.n) + '%;background:var(--dbd-bad)"></span><span style="width:' + w(mixN.p) + '%;background:var(--dbd-orange)"></span><span style="width:' + w(lost) + '%;background:var(--dbd-mute)"></span></div><div class="dbd-legend">' +
        legendItem('var(--dbd-good)', 'Charged', mixN.c, tot) + legendItem('var(--dbd-bad)', 'No Charge', mixN.n, tot) + legendItem('var(--dbd-orange)', 'Comped', mixN.p, tot) + legendItem('var(--dbd-mute)', 'Cancelled', lost, tot) + '</div></div>' +
        '<div class="dbd-card span-6"><p class="dbd-sh">Retention by Quarter <small>' + Math.floor(asOf / 12) + '</small></p><div class="dbd-qgrid">' + q.map(function(x){ var cls = x.rate == null ? 'is-pending' : x.rate >= 0.9 ? 'is-good' : 'is-warn'; return '<div class="dbd-q ' + cls + ' has-tip"' + tip('Q' + x.q + ' ' + Math.floor(asOf / 12), x.partial && x.rate != null ? 'So far' : '', 'On the books at the start::' + x.base + '||Cancelled::' + x.lost, x.rate == null ? '\u2014' : pct(x.rate), 'Retained') + '><span class="dbd-ql">Q' + x.q + '</span><span class="dbd-qv">' + (x.rate == null ? '—' : pct(x.rate)) + '</span></div>'; }).join('') + '</div></div></div>';
      return h;
    }
    function legendItem(color, label, n, tot){ return '<span class="dbd-li"><i style="background:' + color + '"></i>' + label + ' — ' + n + ' (' + (tot ? Math.round(n / tot * 100) : 0) + '%)</span>'; }
    function advisorCounts(){
      var pts = [];
      timeline.forEach(function(idx){ if(idx > asOf) return; var key = idxToYm(idx); pts.push({ idx: idx, v: typeof counts[key] === 'number' ? counts[key] : (activeAt[idx] || []).length, typed: typeof counts[key] === 'number' }); });
      return pts;
    }
    function trendSvg(){
      var pts = advisorCounts(); if(pts.length < 2) return '<div class="dbd-empty">The trend appears once there are two months of billing data.</div>';
      var W = 620, H = 92, vs = pts.map(function(p){ return p.v; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if(hi === lo){ hi++; lo--; }
      var X = function(i){ return i / (pts.length - 1) * W; }, Y = function(v){ return 10 + (1 - (v - lo) / (hi - lo)) * 66; };
      var line = pts.map(function(p, i){ return X(i).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ');
      var s = '<svg class="dbd-trend" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polygon class="dbd-tf" points="0,' + H + ' ' + line + ' ' + W + ',' + H + '"></polygon><polyline class="dbd-tl" points="' + line + '"></polyline>';
      pts.forEach(function(p, i){ s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.6" fill="var(--dbd-blue)" opacity=".6"></circle>'; });
      pts.forEach(function(p, i){ s += '<circle class="dbd-hit has-tip" cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="9"' + tip(idxLabel(p.idx), i === pts.length - 1 ? 'Current' : '', p.typed ? 'Entered by hand::yes' : '', String(p.v), 'Advisors') + '></circle>'; });
      return s + '<circle cx="' + X(pts.length - 1).toFixed(1) + '" cy="' + Y(pts[pts.length - 1].v).toFixed(1) + '" r="3.6" fill="var(--dbd-orange)"></circle></svg>';
    }
    function drawRevenue(){
      var mf = monthFees(asOf, activeAt[asOf] || []), charged = mf.charged, comp = mf.comp, noFee = mf.noFee, sp = monthSpend(asOf);
      var h = '<p class="dbd-intro">Management fees use each office&rsquo;s fee (a fee entered on Monthly spend wins over the Advisor card) and leave out comped fees. Ad spend comes from Advisors &gt; Monthly spend and leaves out comped amounts. Same rules as the Goals page.</p><div class="dbd-grid">' +
        '<div class="dbd-card is-accent span-4"><span class="dbd-kl">Mgmt Revenue</span><span class="dbd-kv">' + usd(charged) + '</span><span class="dbd-ks">fees charged · ' + esc(idxLabel(asOf)) + '</span></div>' +
        '<div class="dbd-card span-4"><span class="dbd-kl">Comped</span><span class="dbd-kv">' + usd(comp) + '</span><span class="dbd-ks">fees waived this month</span></div>' +
        '<div class="dbd-card span-4"><span class="dbd-kl">Ad Spend Entered</span><span class="dbd-kv">' + (sp == null ? '—' : usd(sp)) + '</span><span class="dbd-ks">' + (sp == null ? 'nothing entered for this month yet' : 'all offices, all campaigns') + '</span></div></div>';
      if(noFee) h += '<p class="dbd-note">' + (noFee ? noFee + ' active office' + (noFee === 1 ? ' has' : 's have') + ' no management fee on ' + (noFee === 1 ? 'its' : 'their') + ' Advisor card, so ' + (noFee === 1 ? 'it isn’t' : 'they aren’t') + ' counted above.' : '') + '</p>';
      var end = timeline.indexOf(asOf), from = Math.max(0, end - 11), cols = '', labels = '';
      for(var n = from; n <= end; n++){
        var idx = timeline[n], c = 0, cp = 0, no = 0, cx = 0, amt = 0;
        Object.keys(st).forEach(function(id){ if(advisors[id].coaching) return; var v = st[id][idx]; if(v === 'yes' || v === 'new'){ c++; amt += advisors[id].mgmtFee || 0; } else if(v === 'comp') cp++; else if(v === 'no') no++; else if(v === 'cancelled') cx++; });
        var t = c + cp + no + cx || 1, ph = function(x){ return (x / t * 100).toFixed(1); };
        cols += '<div class="dbd-col has-tip"' + tip(idxLabel(idx, true), idx === asOf ? 'Selected' : '', 'Charged::' + c + ' · ' + Math.round(c / t * 100) + '%||No charge::' + no + '||Comp::' + cp + '||Cancelled::' + cx, usd(amt), 'Mgmt fees charged') + '><i style="height:' + ph(c) + '%;background:var(--dbd-good)"></i><i style="height:' + ph(no) + '%;background:var(--dbd-bad)"></i><i style="height:' + ph(cp) + '%;background:var(--dbd-orange)"></i><i style="height:' + ph(cx) + '%;background:var(--dbd-mute)"></i></div>';
        labels += '<span>' + MON[idx % 12] + '</span>';
      }
      h += '<div class="dbd-grid"><div class="dbd-card span-12"><p class="dbd-sh">Monthly Status Overview <small>up to 12 months · hover a bar</small></p><div class="dbd-stack">' + cols + '</div><div class="dbd-slabels">' + labels + '</div><div class="dbd-legend"><span class="dbd-li"><i style="background:var(--dbd-good)"></i>Charged</span><span class="dbd-li"><i style="background:var(--dbd-bad)"></i>No charge</span><span class="dbd-li"><i style="background:var(--dbd-orange)"></i>Comp</span><span class="dbd-li"><i style="background:var(--dbd-mute)"></i>Cancelled</span></div></div></div>';
      return h;
    }
    function drawPipeline(rows){
      var cur = (activeAt[asOf] || []).length, y = Math.floor(asOf / 12), gained = 0, lost = 0;
      timeline.forEach(function(i){ if(Math.floor(i / 12) === y && i <= asOf){ gained += (newsAt[i] || []).length; lost += (lostAt[i] || []).length; } });
      var net = gained - lost, ws = Object.keys(waits).map(function(id){ var w = waits[id]; w.id = id; return w; }).sort(function(a, b){ return (a.addedAt || 0) - (b.addedAt || 0); });
      var byPod = {}; ws.forEach(function(w){ var k = (w.pod || 'Unassigned').toUpperCase(); byPod[k] = (byPod[k] || 0) + 1; });
      var mf = +settings.mgmt || 1000, ad = +settings.spend || 2000, onb = rows.filter(function(o){ return o.onboarding && !o.coaching; }).length;
      var h = '<p class="dbd-intro">Advisor growth this year and the waitlist of offices waiting to start.</p><div class="dbd-ptiles">' +
        '<div class="dbd-tile"><span>Current</span><b>' + cur + '</b></div>' +
        '<div class="dbd-tile has-tip"' + tip('Net gained in ' + y, '', 'Started::' + gained + '||Cancelled::' + lost, (net > 0 ? '+' : '') + net, 'Net') + '><span>Net Gained</span><b class="' + (net >= 0 ? 'is-good' : 'is-bad') + '">' + (net > 0 ? '+' : '') + net + '</b><small>' + y + ' to date</small></div>' +
        '<div class="dbd-tile has-tip"' + tip('Waitlist', '', Object.keys(byPod).map(function(k){ return k + '::' + byPod[k] + ' prospects'; }).join('||'), String(ws.length), 'Total waiting') + '><span>Waitlist</span><b>' + ws.length + '</b></div>' +
        '<div class="dbd-tile has-tip"' + tip('Onboarding', 'Under 6 months', 'Active offices that have not reached their 6-month point yet', String(onb), 'Offices') + '><span>Onboarding</span><b>' + onb + '</b><small>under 6 months in</small></div></div>';
      h += '<div class="dbd-grid"><div class="dbd-card span-4 has-tip"' + tip('Waitlist Value', 'If all convert', 'Mgmt fees::' + ws.length + ' × ' + usd(mf) + '||Ad spend::' + ws.length + ' × ' + usd(ad), usd(ws.length * (mf + ad)), '/mo potential') + '><span class="dbd-kl">Waitlist Value</span><span class="dbd-kv" style="color:var(--dbd-good)">' + usd(ws.length * (mf + ad)) + '</span><span class="dbd-ks">/mo if all ' + ws.length + ' convert</span>' +
        '<div class="dbd-set"><label>Fee <input type="number" min="0" step="100" id="dbd-s-mgmt" value="' + mf + '"></label><label>Ad spend <input type="number" min="0" step="100" id="dbd-s-spend" value="' + ad + '"></label></div></div>' +
        '<div class="dbd-card span-8"><p class="dbd-sh">Waitlist Queue</p><table class="dbd-table"><thead><tr><th>Company</th><th>Advisor</th><th>Team</th><th style="text-align:right">Wait</th><th></th></tr></thead><tbody>' +
        (ws.map(function(w){ var days = w.addedAt ? Math.max(0, Math.floor((Date.now() - w.addedAt) / 864e5)) : null, wait = days == null ? '—' : days < 14 ? days + ' d' : Math.round(days / 7) + ' wks'; return '<tr><td>' + esc(w.company) + '</td><td>' + esc(w.advisor || '') + '</td><td>' + esc(w.pod || '') + '</td><td style="text-align:right">' + wait + '</td><td style="text-align:right"><button type="button" class="dbd-x" data-wdel="' + esc(w.id) + '" aria-label="Remove ' + esc(w.company) + ' from the waitlist">&times;</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="dbd-empty">Nobody is on the waitlist. Add an office below.</td></tr>') + '</tbody></table>' +
        '<div class="dbd-add"><input id="dbd-w-co" placeholder="Company" maxlength="80"><input id="dbd-w-adv" placeholder="Advisor" maxlength="60"><select id="dbd-w-pod"><option value="">Team</option><option>Eagle</option><option>Ideate</option></select><button type="button" class="dbd-btn" id="dbd-w-add">Add to waitlist</button></div></div></div>';
      return h;
    }
    function drawRetention(rows){
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

    function render(){
      if(!timeline.length){ $('dbd-body').innerHTML = '<div class="dbd-empty" style="padding:40px 10px">The dashboard fills in once the billing year view has a few months of statuses.</div>'; return; }
      var sel = $('dbd-asof'), opts = timeline.slice().reverse().map(function(i){ return '<option value="' + i + '"' + (i === asOf ? ' selected' : '') + '>' + idxLabel(i, true) + '</option>'; }).join('');
      if(sel.dataset.sig !== opts){ sel.innerHTML = opts; sel.dataset.sig = opts; }
      var rows = officeRows(), body = { overview: drawOverview, revenue: drawRevenue, pipeline: drawPipeline, retention: drawRetention }[tab](rows);
      // keep a half-typed waitlist row and the cursor in place across live updates
      var keep = {}; ['dbd-w-co', 'dbd-w-adv', 'dbd-w-pod'].forEach(function(id){ var e = $(id); if(e) keep[id] = e.value; });
      $('dbd-body').innerHTML = body;
      Object.keys(keep).forEach(function(id){ var e = $(id); if(e) e.value = keep[id]; });
      Array.prototype.forEach.call(root.querySelectorAll('.dbd-tab'), function(b){ var on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $('dbd-sub').innerHTML = 'As of <b>' + esc(idxLabel(asOf, true)) + '</b> · live from the Hub';
    }
    // the Growth retention chart reads the same numbers: the share of offices on the books, by month, that haven't cancelled
    window.hubRetention = function(){
      if(!timeline.length) return null;
      var last = timeline[timeline.length - 1], series = [];
      timeline.forEach(function(idx){ var r = retAt(idx); if(r.total) series.push({ idx: idx, rate: r.rate, kept: r.kept, total: r.total, cancelled: (churnAt[idx] || []).map(company) }); });
      var rows = officeRows().filter(function(o){ return !o.coaching; });
      return { series: series, last: last, overall: retAt(last), cancelled: rows.filter(function(o){ return o.cls === 'CANCELLED'; }).map(function(o){ return { name: o.name, cancel: o.cancel }; }) };
    };
    function later(){ if(queued) return; queued = true; setTimeout(function(){ queued = false; compute(); render(); try{ window.dispatchEvent(new Event('hub-six-change')); }catch(e){} }, 60); }

    // ----- tooltip -----
    var tipEl = $('dbd-tip');
    function showTip(el){
      var d = el.dataset, h = '<div class="dbd-th"><span>' + esc(d.tipTitle || '') + '</span>' + (d.tipTag ? '<span class="dbd-tt">' + esc(d.tipTag) + '</span>' : '') + '</div>';
      if(d.tipBody) h += d.tipBody.split('||').map(function(line){ var p = line.split('::'); return p.length === 2 ? '<div class="dbd-tr"><span>' + esc(p[0]) + '</span><span>' + esc(p[1]) + '</span></div>' : '<div class="dbd-tr">' + esc(line) + '</div>'; }).join('');
      if(d.tipValue) h += '<div class="dbd-ta"><span>' + esc(d.tipValueLabel || '') + '</span><span>' + esc(d.tipValue) + '</span></div>';
      tipEl.innerHTML = h; var r = el.getBoundingClientRect(), tw = tipEl.offsetWidth || 160, th = tipEl.offsetHeight || 60, left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8)), top = r.top - th - 10; if(top < 8) top = r.bottom + 10;
      tipEl.style.left = Math.round(left) + 'px'; tipEl.style.top = Math.round(top) + 'px'; tipEl.classList.add('on');
    }
    var hideTip = function(){ tipEl.classList.remove('on'); };
    root.addEventListener('mouseover', function(e){ var t = e.target.closest ? e.target.closest('.has-tip') : null; if(t) showTip(t); });
    root.addEventListener('mouseout', function(e){ var t = e.target.closest ? e.target.closest('.has-tip') : null; if(t && !t.contains(e.relatedTarget)) hideTip(); });
    root.addEventListener('focusin', function(e){ var t = e.target.closest ? e.target.closest('.has-tip') : null; if(t) showTip(t); });
    root.addEventListener('focusout', hideTip);

    // ----- events -----
    root.addEventListener('click', function(e){
      var t = e.target.closest ? e.target.closest('button') : null; if(!t) return;
      if(t.classList.contains('dbd-tab')){ tab = t.dataset.tab; hideTip(); render(); return; }
      if(t.dataset.rf){ retFilter = t.dataset.rf; render(); return; }
      if(t.dataset.wdel && waitCol){ waitCol.doc(t.dataset.wdel).delete().catch(function(){}); return; }
      if(t.id === 'dbd-w-add' && waitCol){
        var co = $('dbd-w-co').value.trim(); if(!co){ $('dbd-w-co').focus(); return; }
        waitCol.add({ company: co, advisor: $('dbd-w-adv').value.trim(), pod: $('dbd-w-pod').value, addedAt: Date.now() }).then(function(){ $('dbd-w-co').value = ''; $('dbd-w-adv').value = ''; $('dbd-w-pod').value = ''; }).catch(function(){});
      }
    });
    root.addEventListener('change', function(e){
      var t = e.target;
      if(t.id === 'dbd-asof'){ asOf = +t.value; render(); return; }
      if(t.dataset && t.dataset.start && datesCol){
        var v = t.value, doc = datesCol.doc(t.dataset.start);
        (v ? doc.set({ start: v, updatedAt: Date.now() }) : doc.delete()).catch(function(){});
        return;
      }
      if((t.id === 'dbd-s-mgmt' || t.id === 'dbd-s-spend') && setCol){ var d = {}; d[t.id === 'dbd-s-mgmt' ? 'mgmt' : 'spend'] = Math.max(0, +t.value || 0); setCol.doc('main').set(Object.assign({}, settings, d)).catch(function(){}); }
    });
    var subTab = document.querySelector('#advpage-subtabs .adv-subtab[data-sub="dashboard"]');
    if(subTab) subTab.addEventListener('click', function(){ later(); });
    window.addEventListener('hub-cancel-change', later);
    if(!(window.claude && window.claude.use)){ render(); return; }
    window.claude.use('db').then(function(db){
      if(!db) return;
      datesCol = db.collection('contract_dates'); waitCol = db.collection('waitlist'); setCol = db.collection('dash_settings');
      var map = function(name, f){ db.collection(name).onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ n[d.id] = d.data() || {}; }); f(n); later(); }, function(){}); };
      db.collection('advisors').onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ var v = d.data() || {}; n[d.id] = { coaching: Array.isArray(v.runs) && v.runs.indexOf('coaching') !== -1, company: String(v.company || d.id), dma: v.dma || '', hours: +v.hours || 0, mgmtFee: typeof v.mgmtFee === 'number' ? v.mgmtFee : null }; }); advisors = n; later(); }, function(){});   // coaching offices are listed on the Retention tab in grey but never counted, same as the Growth count
      map('billing', function(n){ billing = n; }); map('capacity', function(n){ caps = n; }); map('ad_spend', function(n){ spend = n; });
      map('contract_dates', function(n){ dates = n; }); map('waitlist', function(n){ waits = n; });
      db.collection('advisor_counts').onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ var v = d.data() || {}; if(typeof v.count === 'number') n[d.id] = v.count; }); counts = n; later(); }, function(){});
      db.collection('dash_settings').onSnapshot(function(s){ var m = s.docs.filter(function(d){ return d.id === 'main'; })[0]; settings = m ? (m.data() || {}) : {}; later(); }, function(){});
    });
  })();

