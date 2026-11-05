  // ---------- Advisors > Heat map: the AE territory map, drawn from the Advisor list (so offices, zip codes, pods and what they run
  // are always current). Map-only details live in db collection "map_extras" (one doc per advisor: {signature, coverage, density, pins}).
  // Zip, county and state shapes come from three files loaded the first time the tab opens (heatmap/*.json). ----------
  (function(){
    var root = document.getElementById('hm-root');
    if(!root || typeof L === 'undefined') return;
    var $ = function(id){ return document.getElementById(id); };
    var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
    var slug = function(n){ return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); };
    var mgNow = function(){ return (typeof mgmtUnlocked !== 'undefined') && mgmtUnlocked; };
    var isCanc = function(id){ return !!(window.hubIsCancelled && window.hubIsCancelled(id)); };
    var canEdit = function(){ if(mgNow()) return true; var a = window.hubAdvAccess ? window.hubAdvAccess() : null; return a === 'internal'; };
    var SIG = { 'Legend': '#7c3aed', 'Elite': '#2563eb', 'Premier': '#059669', '3M-9.9M': '#d97706', 'Under 3M': '#dc2626', 'New Advisor': '#64748b' };
    var SIG_ORDER = ['Legend', 'Elite', 'Premier', '3M-9.9M', 'Under 3M', 'New Advisor', ''];
    var sigColor = function(s){ return SIG[s] || '#64748b'; };
    var CAMPAIGNS = ['HVO', 'Event', 'General', 'HNW', 'Branding', 'Other'];
    var COVERS = [['none', 'No range set'], ['30', '30 miles'], ['50', '50 miles'], ['75', '75 miles'], ['100', '100 miles'], ['150', '150 miles'], ['200', '200 miles'], ['250', '250 miles'], ['statewide', 'Statewide']];
    var DENS = ['Low', 'Moderate', 'High', 'Very High'];
    var RUN_TO_CAMPAIGN = { hnw: 'HNW', hvo: 'HVO', events: 'Event', strategy: 'General' };   // anything else an office runs counts as Other
    var ABBR2NAME = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };
    var REGION_OF = { 'Arizona':'West','California':'West','Colorado':'West','Hawaii':'West','Idaho':'West','Nevada':'West','New Mexico':'West','Oregon':'West','Utah':'West','Washington':'West','Montana':'West','Wyoming':'West','Alaska':'West','Texas':'Central','Oklahoma':'Central','Kansas':'Central','Missouri':'Central','Nebraska':'Central','Iowa':'Central','Illinois':'Central','Indiana':'Central','Michigan':'Central','Wisconsin':'Central','Minnesota':'Central','North Dakota':'Central','South Dakota':'Central','Louisiana':'Central','Arkansas':'Central','Mississippi':'Central','Tennessee':'Central','Kentucky':'Central','Alabama':'Central','Florida':'East','Georgia':'East','North Carolina':'East','South Carolina':'East','Virginia':'East','West Virginia':'East','Maryland':'East','District of Columbia':'East','Delaware':'East','New Jersey':'East','Pennsylvania':'East','New York':'East','Connecticut':'East','Rhode Island':'East','Massachusetts':'East','Vermont':'East','New Hampshire':'East','Maine':'East' };
    // A few zip codes to fall back on if the big zip file can't be loaded
    var ZIP_FALLBACK = __ZIP_FALLBACK__;

    var STATES_TOPO = __STATES_TOPO__;   // state outlines, built in so there is always a base map
    var NAME2ABBR = {}; Object.keys(ABBR2NAME).forEach(function(k){ NAME2ABBR[ABBR2NAME[k]] = k; });
    var baseMode = 'street', tileOk = false, tileTimer = null, cancelledNoLoc = [], listRows = [], stateLabels = null;
    try{ if(localStorage.getItem('digihub-hm-base') === 'simple') baseMode = 'simple'; }catch(e){}
    var mapOnly = [];   // offices from the original heat map that aren't in the Advisor list (db collection "map_offices")
    var advisors = [], podOf = {}, extras = {}, extrasCol = null, zips = null, counties = null, topo = null, assetsPromise = null, started = false;
    var map = null, cluster = null, coverLayer = null, tiles = null, tileIdx = 0, tileErr = 0, stateLayer = null, densityLayer = null, countyFeats = null, stateFeats = null, countyPop = {};
    var data = [], unplaced = [], current = [], picked = null, filters = { campaignType: {}, signatureStatus: {}, team: {} }, ageData = null, ageLayer = null, ageLoading = false;
    var showCanc = false; try{ showCanc = localStorage.getItem('digihub-hm-canc') === '1'; }catch(e){}

    // ---------- small geometry helpers ----------
    function miles(a, b, c, d){ var R = 3958.8, r = function(x){ return x * Math.PI / 180; }, dl = r(c - a), dn = r(d - b), h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) * Math.sin(dn / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
    var compact = function(n){ return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n)); };
    function nearestCounty(lat, lng){
      if(!counties) return null; var best = null, bd = 1e12, k = Math.cos(lat * Math.PI / 180);
      for(var i = 0; i < counties.length; i++){ var c = counties[i], dy = c[3] - lat, dx = (c[4] - lng) * k, d = dy * dy + dx * dx; if(d < bd){ bd = d; best = c; } }
      return best;
    }
    function topoFeatures(t, obj){
      var sc = t.transform.scale, tl = t.transform.translate;
      var arcs = t.arcs.map(function(arc){ var x = 0, y = 0; return arc.map(function(p){ x += p[0]; y += p[1]; return [x * sc[0] + tl[0], y * sc[1] + tl[1]]; }); });
      var ac = function(i){ return i < 0 ? arcs[~i].slice().reverse() : arcs[i]; };
      var ring = function(list){ var pts = []; list.forEach(function(ai, k){ var c = ac(ai); pts = pts.concat(k ? c.slice(1) : c); }); return pts; };
      var geom = function(g){ return g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) } : g.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: g.arcs.map(function(p){ return p.map(ring); }) } : null; };
      return t.objects[obj].geometries.map(function(g){ return { type: 'Feature', id: g.id, properties: g.properties || {}, geometry: geom(g) }; }).filter(function(f){ return f.geometry; });
    }
    function bboxOf(geom){
      var a = [1e9, 1e9, -1e9, -1e9]; var walk = function(c){ if(typeof c[0] === 'number'){ if(c[0] < a[0]) a[0] = c[0]; if(c[1] < a[1]) a[1] = c[1]; if(c[0] > a[2]) a[2] = c[0]; if(c[1] > a[3]) a[3] = c[1]; } else c.forEach(walk); }; walk(geom.coordinates); return a;
    }
    function inRing(pt, ring){ var inside = false; for(var i = 0, j = ring.length - 1; i < ring.length; j = i++){ var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if(((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
    function inPoly(pt, coords){ if(!inRing(pt, coords[0])) return false; for(var i = 1; i < coords.length; i++) if(inRing(pt, coords[i])) return false; return true; }
    function inFeature(pt, f){ var g = f.geometry; return g.type === 'Polygon' ? inPoly(pt, g.coordinates) : g.coordinates.some(function(p){ return inPoly(pt, p); }); }

    // ---------- data files ----------
    function getJSON(path){ return fetch(path, { cache: 'force-cache' }).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(){ return null; }); }
    function loadAssets(){
      if(assetsPromise) return assetsPromise;
      assetsPromise = Promise.all([getJSON('heatmap/zips.json'), getJSON('heatmap/counties.json'), getJSON('heatmap/us-topo.json')]).then(function(r){
        zips = r[0] || ZIP_FALLBACK; counties = r[1]; topo = r[2];
        if(counties) counties.forEach(function(c){ countyPop[c[0]] = c; });
        setStatus(r[0] ? '' : 'The full zip code file could not be loaded, so only the offices already on the list can be placed.');
        build(); render();
      });
      return assetsPromise;
    }
    function setStatus(t){ var s = $('hm-status'); if(s){ s.textContent = t || ''; s.style.display = t ? '' : 'none'; } }

    // ---------- turn the Advisor list into companies with pins ----------
    function stateOfPoint(lat, lng){ var c = nearestCounty(lat, lng); return c ? c[2] : ''; }
    function placeState(place){ var p = String(place || '').trim(), m = /,\s*([A-Za-z]{2})\s*$/.exec(p); if(m) return m[1].toUpperCase(); if(/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase(); return ''; }
    function cityState(place, stateName){ var p = String(place || '').replace(/\s+/g, ' ').trim(); if(placeState(p)) return p; var ab = NAME2ABBR[stateName]; return ab ? p + ', ' + ab : p; }
    function build(){
      data = []; unplaced = []; cancelledNoLoc = [];
      mapOnly.forEach(function(m){
        var id = 'mo-' + m.id, ex = extras[id] || {}, locs = [];
        (m.locations || []).forEach(function(l, i){
          if(typeof l.lat !== 'number' || typeof l.lng !== 'number'){ unplaced.push({ company: m.company, place: l.place || '(no place)', why: 'virtual or national, so there is no spot to pin' }); return; }
          var st = placeState(l.place || '') || stateOfPoint(l.lat, l.lng);
          locs.push({ id: id + ':' + i, cs: l.place || m.company, label: l.place || m.company, place: l.place || '', lat: l.lat, lng: l.lng, markets: true, verified: !l.approx, note: l.approx ? 'Approximate: placed in the middle of the city or region' : '', state: ABBR2NAME[st] || '' });
        });
        if(locs.length) data.push({ id: id, name: m.company, team: 'Unassigned', signature: ex.signature || '', coverage: ex.coverage || 'none', density: ex.density || 'Moderate', campaigns: ['General'], canc: false, mapOnly: true, locs: locs });
      });
      advisors.forEach(function(a){
        var ex = extras[a.id] || {}, canc = isCanc(a.id), locs = [];
        var camp = []; (a.runs || []).forEach(function(r){ var c = RUN_TO_CAMPAIGN[r] || 'Other'; if(camp.indexOf(c) === -1) camp.push(c); });
        (a.locations || []).forEach(function(l){
          var place = String(l.place || '').trim(), zip = String(l.zip || '').trim(), key = slug(place), pins = ex.pins && ex.pins[key], st = placeState(place);
          if(pins && pins.length){
            pins.forEach(function(p, i){ var s2 = st || stateOfPoint(p.lat, p.lng); locs.push({ id: a.id + ':' + key + ':' + i, cs: p.label || place, label: p.label || place, place: place, lat: p.lat, lng: p.lng, markets: !canc, verified: !p.approx, note: p.approx ? 'Approximate: placed at the middle of the state' : '', state: ABBR2NAME[s2] || '' }); });
            return;
          }
          var z = zips && zip ? zips[zip.slice(0, 5)] : null;
          if(!z){ unplaced.push({ company: a.company, place: place || '(no place)', why: zip ? 'zip ' + zip + ' not found' : 'no zip code' }); return; }
          var zs = stateOfPoint(z[0], z[1]), verified = true, note = '';
          if(st && zs && st !== zs){ verified = false; note = 'Zip ' + zip + ' is in ' + zs + ', but the place says ' + st + '. Check it in the Advisor list.'; }
          locs.push({ id: a.id + ':' + key, cs: cityState(place, ABBR2NAME[st || zs]), label: place + (zip ? ' ' + zip : ''), place: place, lat: z[0], lng: z[1], markets: !canc, verified: verified, note: note, state: ABBR2NAME[st || zs] || '' });
        });
        if(!locs.length && canc) cancelledNoLoc.push(a.company);
        if(locs.length) data.push({ id: a.id, name: a.company, team: podOf[a.dma] || 'Unassigned', signature: ex.signature || '', coverage: ex.coverage || 'none', density: ex.density || 'Moderate', campaigns: camp, canc: canc, locs: locs });
      });
    }

    // ---------- map ----------
    var TILES = [
      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', sub: 'abc', attr: '&copy; OpenStreetMap contributors' },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', sub: 'abc', attr: 'Tiles &copy; Esri' }
    ];
    function loadTiles(i){
      if(tiles) map.removeLayer(tiles); var s = TILES[i];
      tiles = L.tileLayer(s.url, { maxZoom: 18, subdomains: s.sub, attribution: s.attr }).addTo(map); tileErr = 0;
      tiles.on('tileload', function(){ tileOk = true; });
      tiles.on('tileerror', function(){ tileErr++; if(tileErr >= 3 && !tileOk){ if(tileIdx < TILES.length - 1){ tileIdx++; loadTiles(tileIdx); } else tilesFailed(); } });
    }
    function tilesFailed(){ if(baseMode !== 'street') return; applyBase('simple', true); setStatus('The street map pictures can\u2019t load here, so this is the simple map. Offices, labels and overlays all still work.'); }
    // A plain base map made from the state outlines, with state letters, for when pictures can't load (or if you prefer it)
    function showStateOutlines(){
      if(stateLayer) return;
      if(!stateFeats) stateFeats = topoFeatures(STATES_TOPO, 'states');
      stateLayer = L.geoJSON(stateFeats, { style: { color: '#8a94a6', weight: 1, fillColor: '#f1f5f9', fillOpacity: 1 }, interactive: false });
      stateLabels = L.layerGroup(); stateFeats.forEach(function(f){ var ab = NAME2ABBR[f.properties.name]; if(!ab) return; var b = bboxOf(f.geometry); stateLabels.addLayer(L.marker([(b[1] + b[3]) / 2, (b[0] + b[2]) / 2], { icon: L.divIcon({ className: 'hm-stlab', html: ab, iconSize: [30, 14] }), interactive: false, keyboard: false })); });
    }
    function applyBase(mode, auto){
      if(!map) return; baseMode = mode; var el = $('hm-map');
      if(mode === 'simple'){
        if(tiles && map.hasLayer(tiles)) map.removeLayer(tiles);
        showStateOutlines(); if(!map.hasLayer(stateLayer)) stateLayer.addTo(map); stateLayer.bringToBack(); if(!map.hasLayer(stateLabels)) stateLabels.addTo(map); el.classList.add('simple');
      } else {
        el.classList.remove('simple'); if(stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer); if(stateLabels && map.hasLayer(stateLabels)) map.removeLayer(stateLabels);
        tileOk = false; tileIdx = 0; loadTiles(0); clearTimeout(tileTimer); tileTimer = setTimeout(function(){ if(!tileOk && baseMode === 'street') tilesFailed(); }, 7000);
      }
      $('hm-base').value = mode; if(!auto){ try{ localStorage.setItem('digihub-hm-base', mode); }catch(e){} setStatus(''); }
    }
    function pieIcon(c){
      var ms = c.getAllChildMarkers(), counts = {}; ms.forEach(function(m){ var s = m.sig || ''; counts[s] = (counts[s] || 0) + 1; });
      var total = ms.length, acc = 0, stops = [];
      SIG_ORDER.forEach(function(s){ var n = counts[s]; if(!n) return; var a = acc / total * 100; acc += n; stops.push(sigColor(s) + ' ' + a.toFixed(2) + '% ' + (acc / total * 100).toFixed(2) + '%'); });
      var bg = stops.length > 1 ? 'conic-gradient(' + stops.join(',') + ')' : stops[0].split(' ')[0], size = total < 10 ? 36 : total < 50 ? 44 : 52, unv = ms.some(function(m){ return m.verified === false; });
      return L.divIcon({ html: '<div class="hm-pie' + (unv ? ' unv' : '') + '" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + '"><span>' + total + '</span></div>', className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    }
    function dot(color, team, verified, inactive, lab){
      return L.divIcon({ className: '', html: '<div class="hm-dot ' + (team === 'Eagle' ? 'eagle' : team === 'Ideate' ? 'ideate' : 'unas') + (verified === false ? ' unv' : '') + (inactive ? ' off' : '') + '" style="background:' + color + '"></div>' + (lab ? '<span class="hm-lab">' + lab + '</span>' : ''), iconSize: [20, 20], iconAnchor: [10, 10] });
    }
    function initMap(){
      if(map) return;
      map = L.map('hm-map', { minZoom: 3, maxZoom: 18, zoomControl: true, scrollWheelZoom: true, zoomSnap: .25, zoomDelta: .75, wheelPxPerZoomLevel: 90 }).setView([39, -98], 4);
      applyBase(baseMode, true);
      cluster = L.markerClusterGroup({ showCoverageOnHover: false, iconCreateFunction: pieIcon, maxClusterRadius: function(z){ return z < 5 ? 110 : z < 7 ? 80 : z < 9 ? 50 : z < 11 ? 30 : 0; }, disableClusteringAtZoom: 9, spiderfyOnMaxZoom: false });
      coverLayer = L.layerGroup(); map.addLayer(cluster);
      var syncCover = function(){ if(map.getZoom() < 10){ if(map.hasLayer(coverLayer)) map.removeLayer(coverLayer); } else if(!map.hasLayer(coverLayer)) map.addLayer(coverLayer); };
      map.on('zoomend', syncCover); syncCover();
      var syncZoom = function(){ var z = map.getZoom(), el = $('hm-map'); el.classList.toggle('lab-on', z >= 6); el.classList.toggle('st-on', z < 8); };
      map.on('zoomend', syncZoom); syncZoom();
    }

    // ---------- filters ----------
    function facetOn(f){ return Object.keys(filters[f]).filter(function(k){ return filters[f][k]; }); }
    function companyVisible(c){
      var q = ($('hm-search').value || '').trim().toLowerCase();
      var fc = facetOn('campaignType'), fs = facetOn('signatureStatus'), ft = facetOn('team');
      if(fc.length && !fc.some(function(x){ return c.campaigns.indexOf(x) !== -1; })) return false;
      if(fs.length && fs.indexOf(c.signature) === -1) return false;
      if(ft.length && ft.indexOf(c.team) === -1) return false;
      if(!c.locs.some(locVisible)) return false;
      if(q && (c.name + ' ' + c.locs.map(function(l){ return l.label; }).join(' ')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }
    function locVisible(l){ return showCanc || l.markets; }   // cancelled offices only show when the toggle is on

    // ---------- draw ----------
    function render(){
      if(!map || !started) return;
      current = data.filter(companyVisible); cluster.clearLayers(); coverLayer.clearLayers();
      var pins = 0, campaigns = 0;
      current.forEach(function(c){
        c.locs.filter(locVisible).forEach(function(l){
          pins++; if(l.markets) campaigns += c.campaigns.length;
          var color = sigColor(c.signature), cov = c.coverage === 'statewide' ? 'Statewide' : c.coverage === 'none' ? '' : c.coverage + ' miles';
          var m = L.marker([l.lat, l.lng], { icon: dot(color, c.team, l.verified, !l.markets, '<b>' + esc(c.name) + '</b> ' + esc(l.cs || l.place)), title: c.name });
          m.sig = c.signature; m.verified = l.verified;
          m.bindTooltip('<div style="max-width:260px;line-height:1.35"><b>' + esc(c.name) + '</b><br><span style="opacity:.85;font-size:11px">' + esc(l.cs || l.label) + '</span></div>');
          m.bindPopup('<div style="min-width:200px;max-width:260px;line-height:1.4;font-size:12px"><b>' + esc(c.name) + '</b><br><span style="opacity:.85;font-size:11px">' + esc(l.cs || l.label) + '</span><div style="margin:6px 0;display:flex;gap:4px;flex-wrap:wrap"><span class="hm-badge d-' + slug(c.density) + '">' + esc(c.density) + '</span>' + (!l.markets ? '<span class="hm-badge" style="background:#475569">Cancelled</span>' : '') + (c.signature ? '<span class="hm-badge" style="background:' + color + '">' + esc(c.signature) + '</span>' : '') + '</div>' + (l.verified === false ? '<div style="color:#f87171;font-weight:700;font-size:11px">&#9888; ' + esc(l.note || 'Approximate') + '</div>' : '') + '<div style="opacity:.7;font-size:11px;margin-top:4px">' + esc(c.team) + (cov ? ' · ' + cov : '') + '</div></div>');
          m.on('click', function(){ showPotential(c, l); });
          cluster.addLayer(m);
          if(l.markets){
            if(c.coverage === 'statewide'){
              var sf = stateFeature(l.state); if(sf) coverLayer.addLayer(L.geoJSON(sf, { style: { color: color, weight: 2, fillColor: color, fillOpacity: .06, dashArray: '6 4' }, interactive: false }));
            } else if(c.coverage !== 'none'){ coverLayer.addLayer(L.circle([l.lat, l.lng], { radius: Number(c.coverage) * 1609.344, color: color, weight: 2, fillOpacity: .06, dashArray: '6 4', interactive: false })); }
          }
        });
      });
      $('hm-m-companies').textContent = current.length; $('hm-m-pins').textContent = pins; $('hm-m-camp').textContent = campaigns;
      drawFacets(); drawChips(); drawJump(); drawUnplaced(); drawList(); drawCancNote();
      if(!fitted && $('hm-map').clientWidth > 50 && current.length){ fitted = true; fit(); }
    }
    var rendered = false, fitted = false;
    function stateFeature(name){ if(!name) return null; if(!stateFeats) stateFeats = topoFeatures(STATES_TOPO, 'states'); return stateFeats.filter(function(f){ return f.properties.name === name; })[0] || null; }
    function fit(){ var pts = []; current.forEach(function(c){ c.locs.filter(locVisible).forEach(function(l){ pts.push([l.lat, l.lng]); }); }); if(pts.length){ map.invalidateSize(); map.fitBounds(L.latLngBounds(pts).pad(.12), { maxZoom: 7 }); } }

    // ---------- sidebar ----------
    var FACETS = [['campaignType', 'Campaign type', CAMPAIGNS], ['signatureStatus', 'Signature status', SIG_ORDER.slice(0, 6)], ['team', 'Team', ['Eagle', 'Ideate', 'Unassigned']]];
    function drawFacets(){
      var box = $('hm-facets'); if(!box) return;
      var open = {}; box.querySelectorAll('details[data-f]').forEach(function(d){ open[d.dataset.f] = d.open; });
      box.innerHTML = FACETS.map(function(f){
        var on = facetOn(f[0]).length;
        return '<details class="hm-facet" data-f="' + f[0] + '"' + (open[f[0]] ? ' open' : '') + '><summary>' + esc(f[1]) + (on ? ' <b>' + on + '</b>' : '') + '</summary>' + f[2].map(function(v){
          return '<label class="hm-opt"><input type="checkbox" data-f="' + f[0] + '" data-v="' + esc(v) + '"' + (filters[f[0]][v] ? ' checked' : '') + '>' + (f[0] === 'signatureStatus' ? '<i class="hm-sw" style="background:' + sigColor(v) + '"></i>' : '') + esc(v) + '</label>';
        }).join('') + '</details>';
      }).join('');
    }
    function drawChips(){
      var chips = []; FACETS.forEach(function(f){ facetOn(f[0]).forEach(function(v){ chips.push('<span class="hm-chip">' + esc(f[1]) + ': ' + esc(v) + ' <button type="button" data-f="' + f[0] + '" data-v="' + esc(v) + '" aria-label="Remove filter">×</button></span>'); }); });
      $('hm-chips').innerHTML = chips.join('') + (chips.length ? '<button type="button" class="hm-link" id="hm-clear">Clear all</button>' : '');
    }
    function drawJump(){
      var sel = $('hm-jump'), cur = sel.value, states = {};
      data.forEach(function(c){ c.locs.forEach(function(l){ if(l.state) states[l.state] = true; }); });
      var by = {}; Object.keys(states).forEach(function(s){ (by[REGION_OF[s] || 'Other'] = by[REGION_OF[s] || 'Other'] || []).push(s); });
      var h = '<option value="">Jump to…</option>'; ['West', 'Central', 'East', 'Other'].forEach(function(r){ if(!by[r]) return; h += '<option value="region:' + r + '">▸ ' + r + ' (all offices)</option><optgroup label="' + r + ' states">' + by[r].sort().map(function(s){ return '<option value="state:' + esc(s) + '">' + esc(s) + '</option>'; }).join('') + '</optgroup>'; });
      sel.innerHTML = h; sel.value = cur && sel.querySelector('option[value="' + cur + '"]') ? cur : '';
    }
    function drawList(){
      listRows = []; current.forEach(function(c){ c.locs.filter(locVisible).forEach(function(l){ listRows.push({ c: c, l: l }); }); });
      listRows.sort(function(a, b){ return a.c.name.localeCompare(b.c.name) || String(a.l.cs).localeCompare(String(b.l.cs)); });
      $('hm-listn').textContent = listRows.length;
      $('hm-list').innerHTML = listRows.map(function(r, i){ return '<button type="button" class="hm-li" data-i="' + i + '"><i class="hm-sw" style="background:' + sigColor(r.c.signature) + '"></i><span><b>' + esc(r.c.name) + '</b><small>' + esc(r.l.cs || r.l.place) + (r.l.markets ? '' : ' \u00b7 cancelled') + '</small></span></button>'; }).join('') || '<div class="hm-more" style="padding:4px 2px">No offices match.</div>';
    }
    function drawCancNote(){
      var withLoc = data.filter(function(c){ return c.canc; }).length, n = cancelledNoLoc.length, t = '';
      t += showCanc ? (withLoc ? withLoc + ' cancelled office' + (withLoc === 1 ? ' is' : 's are') + ' shown dimmed.' : 'No cancelled offices have a location to show.') : (withLoc ? withLoc + ' cancelled office' + (withLoc === 1 ? ' is' : 's are') + ' hidden.' : '');
      if(n) t += (t ? ' ' : '') + n + ' cancelled office' + (n === 1 ? ' has' : 's have') + ' no location in the Advisor list, so ' + (n === 1 ? 'it can\u2019t' : 'they can\u2019t') + ' be on the map: ' + cancelledNoLoc.slice(0, 6).join(', ') + (n > 6 ? '\u2026' : '') + '.';
      $('hm-canc-note').textContent = t;
    }
    function drawUnplaced(){
      var box = $('hm-unplaced'); if(!unplaced.length){ box.style.display = 'none'; return; }
      box.style.display = ''; box.innerHTML = '<b>' + unplaced.length + ' location' + (unplaced.length === 1 ? '' : 's') + ' not on the map</b><span>Add or fix the zip code in the Advisor list and they appear.</span><ul>' + unplaced.slice(0, 8).map(function(u){ return '<li>' + esc(u.company) + ' · ' + esc(u.place) + ' <small>(' + esc(u.why) + ')</small></li>'; }).join('') + (unplaced.length > 8 ? '<li>+' + (unplaced.length - 8) + ' more</li>' : '') + '</ul>';
    }

    // ---------- market potential card ----------
    function ensureFeats(){ if(!countyFeats && topo){ countyFeats = topoFeatures(topo, 'counties'); countyFeats.forEach(function(f){ var c = countyPop[String(f.id)]; f.properties.pop = c ? c[6] : 0; f.properties.density = c && c[5] && c[6] ? c[6] / c[5] : null; f.properties.bb = bboxOf(f.geometry); }); } return countyFeats; }
    function countyAt(lat, lng){
      var fs = ensureFeats(); if(fs){ var pt = [lng, lat]; for(var i = 0; i < fs.length; i++){ var b = fs[i].properties.bb; if(lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue; if(inFeature(pt, fs[i])){ var c = countyPop[String(fs[i].id)]; return c ? { name: c[1], st: c[2], density: fs[i].properties.density, fips: String(fs[i].id) } : null; } } }
      var n = nearestCounty(lat, lng); return n ? { name: n[1], st: n[2], density: n[5] && n[6] ? n[6] / n[5] : null, fips: n[0] } : null;
    }
    function reach(lat, lng, mi){ var n = 0, pop = 0; if(!counties) return null; counties.forEach(function(c){ if(miles(lat, lng, c[3], c[4]) <= mi){ n++; pop += c[6] || 0; } }); return { n: n, pop: pop }; }
    function showPotential(c, l){
      picked = { c: c, l: l }; var offices = c.locs.filter(locVisible), idx = offices.indexOf(l);
      var cov = c.coverage === 'statewide' ? 'Statewide' : c.coverage === 'none' ? 'No range set' : c.coverage + ' miles';
      $('hm-pot-name').textContent = c.name + ' — ' + l.label;
      $('hm-pot-sig').textContent = c.signature || 'Not set'; $('hm-pot-sig').style.color = sigColor(c.signature);
      $('hm-pot-team').innerHTML = c.team !== 'Unassigned' ? esc(c.team) : '<span style="color:#f87171">Unassigned</span>';
      $('hm-pot-cov').textContent = cov; $('hm-pot-dens').textContent = c.density; $('hm-pot-status').textContent = c.mapOnly ? 'Not in the Advisor list' : c.canc ? 'Cancelled' : 'Active';
      $('hm-pot-offices').textContent = offices.length > 1 ? (idx + 1) + ' of ' + offices.length : String(offices.length);
      $('hm-prev').style.display = $('hm-next').style.display = offices.length > 1 ? '' : 'none';
      $('hm-pot-warn').textContent = l.verified === false ? (l.note || 'Approximate location') : '';
      var ct = countyAt(l.lat, l.lng); $('hm-pot-county').textContent = ct && ct.density != null ? Math.round(ct.density).toLocaleString() + '/sq mi (' + ct.name + ' County, ' + ct.st + ')' : '—';
      $('hm-pot-age').textContent = '—'; getAge().then(function(ad){ if(ad && ct && ct.fips && ad[ct.fips] && picked && picked.l === l) $('hm-pot-age').textContent = ad[ct.fips][0].toLocaleString() + ' (' + ad[ct.fips][1] + '% of the county)'; });
      [30, 60, 120].forEach(function(mi){ var r = reach(l.lat, l.lng, mi); $('hm-pot-r' + mi).textContent = r ? r.n + ' counties · ~' + compact(r.pop) + ' people' : '—'; });
      var comp = []; data.forEach(function(o){ o.locs.forEach(function(x){ if(x !== l && x.state && x.state === l.state && locVisible(x)) comp.push({ name: o.name, sig: o.signature, d: miles(l.lat, l.lng, x.lat, x.lng) }); }); }); comp.sort(function(a, b){ return a.d - b.d; });
      $('hm-pot-comp').textContent = l.state ? comp.length : '—';
      $('hm-pot-complist').innerHTML = comp.length ? comp.slice(0, 10).map(function(x){ return '<div class="hm-comp"><span>' + esc(x.name) + (x.sig ? ' <em style="color:' + sigColor(x.sig) + '">(' + esc(x.sig) + ')</em>' : '') + '</span><b>' + Math.round(x.d) + ' mi</b></div>'; }).join('') + (comp.length > 10 ? '<div class="hm-comp hm-more">+' + (comp.length - 10) + ' more</div>' : '') : '<div class="hm-comp hm-more">No other AE clients in this state.</div>';
      drawEdit(c); $('hm-pot').classList.add('has');
    }
    function drawEdit(c){
      var box = $('hm-edit'); if(!canEdit()){ box.style.display = 'none'; return; }
      box.style.display = '';
      $('hm-e-sig').innerHTML = '<option value="">Not set</option>' + SIG_ORDER.slice(0, 6).map(function(s){ return '<option' + (c.signature === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
      $('hm-e-cov').innerHTML = COVERS.map(function(o){ return '<option value="' + o[0] + '"' + (c.coverage === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
      $('hm-e-dens').innerHTML = DENS.map(function(s){ return '<option' + (c.density === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
      $('hm-e-msg').textContent = '';
    }
    $('hm-e-save').addEventListener('click', function(){
      if(!picked || !extrasCol || !canEdit()) return;
      var c = picked.c, old = extras[c.id] || {}, by = ''; try{ by = localStorage.getItem('digihub-trainer-name') || ''; }catch(e){}
      var doc = Object.assign({}, old, { signature: $('hm-e-sig').value, coverage: $('hm-e-cov').value, density: $('hm-e-dens').value, updatedBy: by || 'Someone on the team', updatedAt: Date.now() });
      extras[c.id] = doc; extrasCol.doc(c.id).set(doc).catch(function(){ $('hm-e-msg').textContent = 'That didn’t save. Try again.'; });
      var loc = picked.l.id; build(); render();
      var nc = data.filter(function(x){ return x.id === c.id; })[0]; if(nc){ var nl = nc.locs.filter(function(x){ return x.id === loc; })[0]; if(nl) showPotential(nc, nl); }
      $('hm-e-msg').textContent = 'Saved.';
    });
    function step(d){ if(!picked) return; var offices = picked.c.locs.filter(locVisible); if(offices.length < 2) return; var i = (offices.indexOf(picked.l) + d + offices.length) % offices.length, l = offices[i]; map.flyTo([l.lat, l.lng], Math.max(map.getZoom(), 9)); showPotential(picked.c, l); }
    $('hm-prev').addEventListener('click', function(){ step(-1); }); $('hm-next').addEventListener('click', function(){ step(1); });

    // ---------- density overlay ----------
    var DENS_STOPS = ['#fde047', '#fbbf24', '#f97316', '#ef4444', '#dc2626', '#9f1239', '#4c0519'];
    function hex(h){ var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function densColor(v){ var t = Math.log(Math.max(v, 1)) / Math.log(8000); t = Math.max(0, Math.min(1, t)); var n = DENS_STOPS.length - 1, seg = t * n, i = Math.min(Math.floor(seg), n - 1), f = seg - i, a = hex(DENS_STOPS[i]), b = hex(DENS_STOPS[i + 1]); return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')'; }
    function toggleDensity(on){
      var lg = $('hm-dlegend');
      if(!on){ if(densityLayer && map.hasLayer(densityLayer)) map.removeLayer(densityLayer); lg.classList.remove('show'); dimTiles(); return; }
      var fs = ensureFeats(); if(!fs){ lg.classList.add('show'); lg.querySelector('b').textContent = 'County shapes could not be loaded'; return; }
      if(!densityLayer){
        densityLayer = L.geoJSON(fs.filter(function(f){ return f.properties.density != null; }), { renderer: L.canvas(), style: function(f){ return { fillColor: densColor(f.properties.density), fillOpacity: .92, color: '#ffffff', weight: .3, opacity: .45 }; }, onEachFeature: function(f, layer){ var c = countyPop[String(f.id)]; layer.bindTooltip('<div style="max-width:240px;line-height:1.35"><b>' + esc(f.properties.name) + ' County' + (c ? ', ' + c[2] : '') + '</b><br><span style="opacity:.85;font-size:10px">' + Math.round(f.properties.density).toLocaleString() + ' people/sq mi</span></div>'); } });
      }
      densityLayer.addTo(map); densityLayer.bringToBack(); dimTiles(); lg.classList.add('show'); lg.querySelector('b').textContent = 'Population density (people/sq mi, by county)';
    }

    function dimTiles(){ if(tiles) tiles.setOpacity(($('hm-density').checked || $('hm-age').checked) ? .5 : 1); }
    // residents aged 55-64 by county (Census estimates, July 2022), shown instead of the density overlay
    var AGE_STOPS = ['#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8', '#1e3a8a', '#0b1b4d'];
    function ageColor(v){ var t = (Math.log(Math.max(v, 1)) - Math.log(100)) / (Math.log(200000) - Math.log(100)); t = Math.max(0, Math.min(1, t)); var n = AGE_STOPS.length - 1, seg = t * n, i = Math.min(Math.floor(seg), n - 1), f = seg - i, a = hex(AGE_STOPS[i]), b = hex(AGE_STOPS[i + 1]); return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')'; }
    function getAge(){ if(ageData) return Promise.resolve(ageData); if(ageLoading) return ageLoading; ageLoading = getJSON('heatmap/age.json').then(function(d){ ageData = d; ageLoading = false; return d; }); return ageLoading; }
    function toggleAge(on){
      var lg = $('hm-alegend');
      if(!on){ if(ageLayer && map.hasLayer(ageLayer)) map.removeLayer(ageLayer); lg.classList.remove('show'); dimTiles(); return; }
      lg.classList.add('show'); lg.querySelector('b').textContent = 'Loading 55-64 age data…';
      getAge().then(function(ad){
        var fs = ensureFeats();
        if(!ad || !fs){ lg.querySelector('b').textContent = 'Could not load the age data'; return; }
        if(!$('hm-age').checked) return;
        if(!ageLayer){
          ageLayer = L.geoJSON(fs, { renderer: L.canvas(), style: function(f){ var a = ad[String(f.id)]; return { fillColor: a ? ageColor(a[0]) : '#334155', fillOpacity: .9, color: '#ffffff', weight: .35, opacity: .5 }; }, onEachFeature: function(f, layer){ var a = ad[String(f.id)], c = countyPop[String(f.id)]; layer.bindTooltip('<div style="max-width:240px;line-height:1.35"><b>' + esc(f.properties.name) + ' County' + (c ? ', ' + c[2] : '') + '</b><br><span style="opacity:.85;font-size:10px">' + (a ? a[0].toLocaleString() + ' residents aged 55-64 (' + a[1] + '% of pop.)' : 'No data') + '</span></div>'); } });
        }
        ageLayer.addTo(map); ageLayer.bringToBack(); dimTiles(); lg.querySelector('b').textContent = 'Residents aged 55-64 (by county)';
      });
    }

    // ---------- events ----------
    root.addEventListener('change', function(e){
      var t = e.target;
      if(t.matches('input[type=checkbox][data-f]')){ filters[t.dataset.f][t.dataset.v] = t.checked; render(); }
      else if(t.id === 'hm-density'){ loadAssets().then(function(){ if(t.checked && $('hm-age').checked){ $('hm-age').checked = false; toggleAge(false); } toggleDensity(t.checked); }); }
      else if(t.id === 'hm-age'){ loadAssets().then(function(){ if(t.checked && $('hm-density').checked){ $('hm-density').checked = false; toggleDensity(false); } toggleAge(t.checked); }); }
      else if(t.id === 'hm-base'){ applyBase(t.value, false); render(); }
      else if(t.id === 'hm-showcanc'){ showCanc = t.checked; try{ localStorage.setItem('digihub-hm-canc', showCanc ? '1' : '0'); }catch(e){} render(); if(picked && !locVisible(picked.l)){ picked = null; $('hm-pot').classList.remove('has'); } }
      else if(t.id === 'hm-jump') jumpTo(t.value);
    });
    root.addEventListener('click', function(e){
      var li = e.target.closest('.hm-li'); if(li){ var r = listRows[+li.dataset.i]; if(r){ map.flyTo([r.l.lat, r.l.lng], Math.max(map.getZoom(), 9)); showPotential(r.c, r.l); } return; }
      var b = e.target.closest('.hm-chip button'); if(b){ filters[b.dataset.f][b.dataset.v] = false; render(); return; }
      if(e.target.id === 'hm-clear'){ Object.keys(filters).forEach(function(f){ filters[f] = {}; }); render(); return; }
      if(e.target.id === 'hm-fit'){ fit(); return; }
      if(e.target.id === 'hm-reset'){ Object.keys(filters).forEach(function(f){ filters[f] = {}; }); $('hm-search').value = ''; $('hm-jump').value = ''; render(); fit(); }
    });
    $('hm-search').addEventListener('input', function(){ render(); });
    function jumpTo(val){
      if(!val) return; var isR = val.indexOf('region:') === 0, key = val.slice(val.indexOf(':') + 1), pts = [];
      data.forEach(function(c){ c.locs.forEach(function(l){ if(isR ? (REGION_OF[l.state] || 'Other') === key : l.state === key) pts.push([l.lat, l.lng]); }); });
      if(pts.length) map.flyToBounds(L.latLngBounds(pts).pad(.2), { maxZoom: 9 });
    }

    // ---------- start, live data ----------
    var queued = false;
    function later(){ if(queued) return; queued = true; setTimeout(function(){ queued = false; if(started && zips){ build(); render(); if(picked){ var c = data.filter(function(x){ return x.id === picked.c.id; })[0], l = c && c.locs.filter(function(x){ return x.id === picked.l.id; })[0]; if(c && l) showPotential(c, l); } } }, 80); }
    function start(){
      $('hm-showcanc').checked = showCanc;
      if(!started){ started = true; initMap(); setStatus('Loading map data…'); loadAssets(); }
      setTimeout(function(){ if(map){ map.invalidateSize(); if(!fitted && current.length && $('hm-map').clientWidth > 50){ fitted = true; fit(); } } }, 150);
      if(started) later();
    }
    var tab = document.querySelector('#advpage-subtabs .adv-subtab[data-sub="heatmap"]');
    if(tab) tab.addEventListener('click', start);
    window.addEventListener('hub-cancel-change', later);
    window.addEventListener('resize', function(){ if(map) map.invalidateSize(); });
    setTimeout(function(){ var p = window.hubRenderAdvisors; window.hubRenderAdvisors = function(){ if(p) p(); later(); if(picked) drawEdit(picked.c); }; }, 0);
    if(!(window.claude && window.claude.use)) return;
    window.claude.use('db').then(function(db){
      if(!db) return;
      extrasCol = db.collection('map_extras');
      db.collection('advisors').onSnapshot(function(s){ advisors = s.docs.map(function(d){ var v = d.data() || {}; return { id: d.id, company: String(v.company || ''), dma: v.dma || '', runs: Array.isArray(v.runs) ? v.runs : [], locations: Array.isArray(v.locations) ? v.locations : [] }; }); later(); }, function(){});
      db.collection('capacity').onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ var v = d.data() || {}; if(v.name && v.pod) n[v.name] = v.pod; }); podOf = n; later(); }, function(){});
      extrasCol.onSnapshot(function(s){ var n = {}; s.docs.forEach(function(d){ n[d.id] = d.data() || {}; }); extras = n; later(); }, function(){});
      db.collection('map_offices').onSnapshot(function(s){ mapOnly = s.docs.map(function(d){ var v = d.data() || {}; return { id: d.id, company: String(v.company || d.id), locations: Array.isArray(v.locations) ? v.locations : [] }; }); later(); }, function(){});
    });
  })();

