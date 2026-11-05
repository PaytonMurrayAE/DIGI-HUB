r=open('v216.rb',encoding='utf-8').read()
block = r'''
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
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v224.html","hub_v225.html")
open('v216.rb','w',encoding='utf-8').write(r)
c=open('v216.css',encoding='utf-8').read()
c+="""
  .gl-allbtn{ margin-left:6px; font:700 11px 'Sora',sans-serif; letter-spacing:.04em; text-transform:uppercase; padding:7px 12px; border-radius:999px; border:1px solid var(--line); background:var(--surface-2); color:var(--ink); cursor:pointer; } .gl-allbtn.on{ background:#2266FF; border-color:#2266FF; color:#fff; }
  .gl-yearhead{ display:flex; align-items:baseline; gap:10px; margin:18px 0 8px; } .gl-yearhead:first-child{ margin-top:2px; } .gl-yearhead b{ font-family:var(--font-head); font-size:20px; } .gl-yearhead span{ font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-faint); }
"""
open('v216.css','w',encoding='utf-8').write(c)
