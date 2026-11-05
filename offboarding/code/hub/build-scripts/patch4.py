r=open('v216.rb',encoding='utf-8').read()
block = r'''
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
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v222.html","hub_v223.html")
open('v216.rb','w',encoding='utf-8').write(r)
c=open('v216.css',encoding='utf-8').read()
c+="""
  table.ae-table td.ae-del{ text-align:center; vertical-align:middle; }
  .ae-delbtn{ font:700 11px 'Sora',sans-serif; color:#b3261e; background:#fff; border:1px solid #e0a29d; border-radius:8px; padding:5px 10px; cursor:pointer; white-space:nowrap; } .ae-delbtn:hover{ background:#fdecea; } .ae-delbtn.on{ background:#b3261e; color:#fff; border-color:#b3261e; }
  .ae-dup{ margin-top:4px; font-size:11px; font-weight:600; color:#c4470a; line-height:1.3; }
"""
open('v216.css','w',encoding='utf-8').write(c)
