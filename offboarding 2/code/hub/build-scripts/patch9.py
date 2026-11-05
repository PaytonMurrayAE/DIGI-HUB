r=open('v216.rb',encoding='utf-8').read()
block = r'''
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
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v229.html","hub_v230.html")
open('v216.rb','w',encoding='utf-8').write(r)
