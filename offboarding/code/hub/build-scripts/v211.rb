# encoding: utf-8
s = File.read('hub_v210.html', encoding: 'utf-8')
rep = lambda { |from, to| c = s.scan(from).size; abort("expected 1 got #{c}: #{from[0,100]}") unless c == 1; s.sub!(from) { to } }
# subtab
rep.('        <button type="button" class="adv-subtab" data-sub="growth">Growth</button>', '        <button type="button" class="adv-subtab" data-sub="growth">Growth</button>' + "\n" + '        <button type="button" class="adv-subtab" data-sub="heatmap">Heat map</button>')
panel = <<'HTML'
      <div class="adv-subpanel" id="advpage-subpanel-heatmap">
        <div id="hm-root">
          <aside class="hm-side">
            <div class="hm-metrics"><div><b id="hm-m-companies">0</b><span>Companies</span></div><div><b id="hm-m-pins">0</b><span>Locations</span></div><div><b id="hm-m-camp">0</b><span>Campaigns</span></div></div>
            <div class="hm-panel">
              <h4>Search &amp; filter</h4>
              <div class="hm-row"><input id="hm-search" type="text" placeholder="Search a company or place…" autocomplete="off" aria-label="Search the map"><button type="button" class="hm-btn" id="hm-reset">Reset</button></div>
              <div class="hm-row"><select id="hm-jump" aria-label="Jump to a region or state"></select><button type="button" class="hm-btn" id="hm-fit">Fit all</button></div>
              <select id="hm-base" aria-label="Base map"><option value="street">Street map</option><option value="simple">Simple map (state outlines)</option></select>
              <div class="hm-chips" id="hm-chips"></div>
              <div id="hm-facets"></div>
              <label class="hm-check"><input type="checkbox" id="hm-showcanc"> Show cancelled offices</label>
              <div class="hm-note" id="hm-canc-note"></div>
              <label class="hm-check"><input type="checkbox" id="hm-density"> Show population density overlay</label>
              <label class="hm-check"><input type="checkbox" id="hm-age"> Show residents aged 55-64 overlay</label>
              <div class="hm-dlegend" id="hm-dlegend"><b>Population density</b><div class="hm-gradient" style="background:linear-gradient(90deg,#fde047,#fbbf24,#f97316,#ef4444,#dc2626,#9f1239,#4c0519)"></div><div class="hm-dlabels"><span>1</span><span>10</span><span>100</span><span>1,000</span><span>8,000+</span></div><div class="hm-dunit">people per square mile</div></div>
              <div class="hm-dlegend" id="hm-alegend"><b>Residents aged 55-64</b><div class="hm-gradient" style="background:linear-gradient(90deg,#93c5fd,#60a5fa,#2563eb,#1d4ed8,#1e3a8a,#0b1b4d)"></div><div class="hm-dlabels"><span>100</span><span>1,000</span><span>10,000</span><span>100,000+</span></div><div class="hm-dunit">people aged 55-64 in the county</div></div>
            </div>
            <div class="hm-panel hm-unplaced" id="hm-unplaced" style="display:none;"></div>
            <div class="hm-panel"><details class="hm-facet" open><summary>Offices on the map <b id="hm-listn">0</b></summary><div class="hm-list" id="hm-list"></div></details></div>
            <div class="hm-panel" id="hm-pot">
              <h4>Market potential</h4>
              <div class="hm-pot-empty">Click an office on the map to see its details, nearby population and the other AE offices in its state.</div>
              <div class="hm-pot-body">
                <div class="hm-pot-name" id="hm-pot-name"></div>
                <div class="hm-warn" id="hm-pot-warn"></div>
                <div class="hm-sub">Overview</div>
                <div class="hm-grid"><span>Signature status</span><span id="hm-pot-sig">—</span><span>Team</span><span id="hm-pot-team">—</span><span>Status</span><span id="hm-pot-status">—</span><span>Coverage</span><span id="hm-pot-cov">—</span><span>Market density</span><span id="hm-pot-dens">—</span><span>Office</span><span id="hm-pot-offices">—</span></div>
                <div class="hm-nav"><button type="button" class="hm-btn" id="hm-prev">&#8249; Previous office</button><button type="button" class="hm-btn" id="hm-next">Next office &#8250;</button></div>
                <div class="hm-sub">Local density</div>
                <div class="hm-grid"><span>Population density</span><span id="hm-pot-county">—</span><span>Aged 55-64</span><span id="hm-pot-age">—</span></div>
                <div class="hm-sub">Reach &amp; scale</div>
                <div class="hm-grid"><span>30-mile reach</span><span id="hm-pot-r30">—</span><span>60-mile reach</span><span id="hm-pot-r60">—</span><span>120-mile reach</span><span id="hm-pot-r120">—</span></div>
                <div class="hm-sub">Competition</div>
                <div class="hm-grid"><span>Other AE clients in state</span><span id="hm-pot-comp">—</span></div>
                <div id="hm-pot-complist"></div>
                <div class="hm-edit" id="hm-edit" style="display:none;">
                  <div class="hm-sub">Map details</div>
                  <label for="hm-e-sig">Signature status</label><select id="hm-e-sig"></select>
                  <label for="hm-e-cov">Coverage</label><select id="hm-e-cov"></select>
                  <label for="hm-e-dens">Market density</label><select id="hm-e-dens"></select>
                  <button type="button" class="hm-btn" id="hm-e-save">Save map details</button><span class="hm-warn" id="hm-e-msg" style="color:#9ec5fe;"></span>
                </div>
              </div>
            </div>
            <div class="hm-panel hm-key">
              <h4>Map key</h4>
              <div class="hm-sub">Signature status</div>
              <div class="k"><i class="sw" style="background:#7c3aed"></i>Legend</div><div class="k"><i class="sw" style="background:#2563eb"></i>Elite</div><div class="k"><i class="sw" style="background:#059669"></i>Premier</div><div class="k"><i class="sw" style="background:#d97706"></i>3M-9.9M</div><div class="k"><i class="sw" style="background:#dc2626"></i>Under 3M</div><div class="k"><i class="sw" style="background:#64748b"></i>New Advisor / not set</div>
              <div class="hm-sub">Team (ring)</div>
              <div class="k"><i class="ring" style="border-color:#2563eb"></i>Eagle</div><div class="k"><i class="ring" style="border-color:#7c3aed"></i>Ideate</div><div class="k"><i class="ring" style="border-color:#64748b"></i>Unassigned</div>
              <div class="hm-sub">Other markers</div>
              <div class="k"><i class="sw" style="background:#64748b;opacity:.4"></i>Cancelled office (dimmed)</div><div class="k"><i class="sw" style="background:#dc2626"></i>Red dot: location is approximate</div>
            </div>
          </aside>
          <div class="hm-main"><div id="hm-map"></div><div class="hm-status" id="hm-status" style="display:none;"></div></div>
        </div>
      </div>

HTML
rep.('      <div class="adv-subpanel" id="advpage-subpanel-capacity">', panel + '      <div class="adv-subpanel" id="advpage-subpanel-capacity">')
# libs before the first script
leaf_css = File.read('net/leaflet.css', encoding: 'utf-8').gsub(/url\(images\/[^)]*\)/, 'none')
libs_css = "<style>\n" + leaf_css + "\n" + File.read('net/mc.css', encoding: 'utf-8') + "\n" + File.read('net/mcd.css', encoding: 'utf-8') + "\n</style>\n"
libs_js = "<script>\n" + File.read('net/leaflet.js', encoding: 'utf-8') + "\n</script>\n<script>\n" + File.read('net/mc.js', encoding: 'utf-8') + "\n</script>\n"
i = s.index('<script') or abort('noscript')
s[i...i] = libs_css + libs_js
js = File.read('v211_heatmap.js', encoding: 'utf-8').sub('__ZIP_FALLBACK__') { File.read('net/zip_fallback.json') }.sub('__STATES_TOPO__') { File.read('net/states.json').gsub(/\s+/, '') }
rep.("  // ---------- Advisors: the list of things an office can run.", js + "  // ---------- Advisors: the list of things an office can run.")
rep.("  .ae-run-item{", File.read('v211.css', encoding: 'utf-8') + "  .ae-run-item{")
s.sub!(/HUB_BUILD = \d+/) { "HUB_BUILD = #{(Time.now.to_f*1000).to_i}" } or abort('f')
File.write('hub_v215.html', s)
s.sub!("<script src=") { "<script src=" } 
t = s.sub("<script") { "<script src=\"mock.js?v=110\"></script><script" }
# the libs script comes first now; mock must come before main script but order vs libs does not matter
File.write('prev/index.html', t); puts "ok #{s.size}"
