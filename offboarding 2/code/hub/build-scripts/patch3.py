# ---- A. heat map: map-only offices ----
p='v211_heatmap.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:80],s.count(a)); s=s.replace(a,b)
rep("    var advisors = [], podOf = {}, extras = {},","    var mapOnly = [];   // offices from the original heat map that aren't in the Advisor list (db collection \"map_offices\")\n    var advisors = [], podOf = {}, extras = {},")
rep("    function build(){\n      data = []; unplaced = []; cancelledNoLoc = [];","    function build(){\n      data = []; unplaced = []; cancelledNoLoc = [];\n      mapOnly.forEach(function(m){\n        var id = 'mo-' + m.id, ex = extras[id] || {}, locs = [];\n        (m.locations || []).forEach(function(l, i){\n          if(typeof l.lat !== 'number' || typeof l.lng !== 'number'){ unplaced.push({ company: m.company, place: l.place || '(no place)', why: 'virtual or national, so there is no spot to pin' }); return; }\n          var st = placeState(l.place || '') || stateOfPoint(l.lat, l.lng);\n          locs.push({ id: id + ':' + i, cs: l.place || m.company, label: l.place || m.company, place: l.place || '', lat: l.lat, lng: l.lng, markets: true, verified: !l.approx, note: l.approx ? 'Approximate: placed in the middle of the city or region' : '', state: ABBR2NAME[st] || '' });\n        });\n        if(locs.length) data.push({ id: id, name: m.company, team: 'Unassigned', signature: ex.signature || '', coverage: ex.coverage || 'none', density: ex.density || 'Moderate', campaigns: ['General'], canc: false, mapOnly: true, locs: locs });\n      });")
rep("$('hm-pot-status').textContent = c.canc ? 'Cancelled' : 'Active';","$('hm-pot-status').textContent = c.mapOnly ? 'Not in the Advisor list' : c.canc ? 'Cancelled' : 'Active';")
rep("      extrasCol.onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ n[d.id] = d.data() || {}; }); extras = n; later(); }, function(){});","      extrasCol.onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ n[d.id] = d.data() || {}; }); extras = n; later(); }, function(){});\n      db.collection('map_offices').onSnapshot(function(s){ mapOnly = s.docs.map(function(d){ var v = d.data() || {}; return { id: d.id, company: String(v.company || d.id), locations: Array.isArray(v.locations) ? v.locations : [] }; }); later(); }, function(){});")
open(p,'w',encoding='utf-8').write(s)

# ---- B. dashboard revenue: same fee/spend rules as Goals ----
p='v216_dash.js'; s=open(p,encoding='utf-8').read()
a=s.index("    function monthSpend(idx){"); b=s.index("    function people(){")
s=s[:a]+r"""    function monthSpend(idx){
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
"""+s[b:]
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:80],s.count(a)); s=s.replace(a,b)
rep("      var charged = 0, comp = 0, nocharge = 0, noFee = 0;\n      (activeAt[asOf] || []).forEach(function(id){ var v = statusAt(id, asOf), fee = advisors[id].mgmtFee; if(fee == null){ noFee++; return; } if(v === 'comp') comp += fee; else if(v === 'no') nocharge += fee; else charged += fee; });\n      var sp = monthSpend(asOf);",
    "      var mf = monthFees(asOf, activeAt[asOf] || []), charged = mf.charged, comp = mf.comp, noFee = mf.noFee, sp = monthSpend(asOf);")
rep("Management fees come from each office&rsquo;s fee on its Advisor card and its ' + esc(idxLabel(asOf, true)) + ' billing status. Ad spend comes from Advisors &gt; Monthly spend.","Management fees use each office&rsquo;s fee (a fee entered on Monthly spend wins over the Advisor card) and leave out comped fees. Ad spend comes from Advisors &gt; Monthly spend and leaves out comped amounts. Same rules as the Goals page.")
rep("'<div class=\"dbd-card span-4\"><span class=\"dbd-kl\">Comped</span><span class=\"dbd-kv\">' + usd(comp) + '</span><span class=\"dbd-ks\">fees waived this month</span></div>'","'<div class=\"dbd-card span-4\"><span class=\"dbd-kl\">Comped</span><span class=\"dbd-kv\">' + usd(comp) + '</span><span class=\"dbd-ks\">fees waived this month</span></div>'")
rep("      if(nocharge || noFee) h += '<p class=\"dbd-note\">' + (nocharge ? usd(nocharge) + ' of fees sit on offices marked NO CHARGE this month. ' : '') + (noFee ?","      if(noFee) h += '<p class=\"dbd-note\">' + (noFee ?")
rep("if(v === 'yes' || v === 'new'){ c++; amt += advisors[id].mgmtFee || 0; }","if(v === 'yes' || v === 'new'){ c++; amt += advisors[id].mgmtFee || 0; }")
open(p,'w',encoding='utf-8').write(s)

# ---- C. goals ----
r=open('v216.rb',encoding='utf-8').read()
g = r'''
# ---- Goals: retention rate = the Dashboard's retention rate ----
rep.("hint: 'Of the offices active last December, the share that haven’t cancelled this year (Coaching offices aren\\u2019t counted).' }", "hint: 'The same retention rate as the Dashboard: of every office on the books, the share that haven\\u2019t cancelled, whenever they cancelled (Coaching offices aren\\u2019t counted).' }")
rep.("        var base = 0, kept = 0;\n        advisors.forEach(function(a){ if((a.runs || []).indexOf('coaching') !== -1) return; if(!activeAt(a.id, y - 1, 12)) return; base++; var c = false; for(var m = 1; m <= 12; m++) if(st(a.id, y, m) === 'cancelled') c = true; if(!c) kept++; });\n        return base ? Math.round(kept / base * 1000) / 10 : null;",
     "        var S = window.hubRetention ? window.hubRetention() : null; if(!S) return null;\n        var pts = S.series.filter(function(p){ return Math.floor(p.idx / 12) === y; });\n        return pts.length ? Math.round(pts[pts.length - 1].rate * 1000) / 10 : null;")
rep.("    window.addEventListener('hub-cancel-change', later);\n", "    window.addEventListener('hub-cancel-change', later);\n    window.addEventListener('hub-six-change', later);\n")
'''
r=r.replace("s.sub!(/HUB_BUILD", g+"s.sub!(/HUB_BUILD",1).replace("hub_v221.html","hub_v222.html")
# base file for the build must be the same v215 base: keep
open('v216.rb','w',encoding='utf-8').write(r)
