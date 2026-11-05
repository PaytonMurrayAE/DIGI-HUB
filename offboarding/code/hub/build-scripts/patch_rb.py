r=open('v216.rb',encoding='utf-8').read()
a=r.index("# ---- Growth retention chart"); b=r.index("s.sub!(/HUB_BUILD")
g = r'''# ---- Growth retention chart: same retention numbers as the Dashboard ----
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
'''
r=r[:a]+g+r[b:]
r=r.replace("hub_v220.html","hub_v221.html")
open('v216.rb','w',encoding='utf-8').write(r)
