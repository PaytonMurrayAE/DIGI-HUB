r=open('v216.rb',encoding='utf-8').read()
block = r'''
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
rep.("kudosCol.orderBy('ts', 'desc').limit(50).onSnapshot(", "kudosCol.orderBy('ts', 'desc').limit(300).onSnapshot(")
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v223.html","hub_v224.html")
open('v216.rb','w',encoding='utf-8').write(r)
