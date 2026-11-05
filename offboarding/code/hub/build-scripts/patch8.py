r=open('v216.rb',encoding='utf-8').read()
block = r'''
# ---- One shared live connection per collection (the page had ~73 duplicate listeners, and the last ones, like Kudos, were failing) ----
shared_js = <<'JS'
<script>
// Every part of the Hub asks for the same few collections (advisors, billing, capacity...). Instead of each one opening its own live
// connection, they all share one per collection. window.hubDb() works like claude.use('db').
(function(){
  var wrapped = null, entries = {};
  function subscribe(name, real, cb, errCb){
    var e = entries[name] || (entries[name] = { subs: [], last: null, hasLast: false, unsub: null }), sub = { cb: cb, err: errCb };
    e.subs.push(sub);
    if(!e.unsub){
      e.unsub = real.onSnapshot(function(snap){
        e.last = snap; e.hasLast = true;
        e.subs.slice().forEach(function(s){ try{ s.cb(snap); }catch(x){ if(window.console) console.error('snapshot callback', name, x); } });
      }, function(err){
        e.subs.slice().forEach(function(s){ if(s.err){ try{ s.err(err); }catch(x){} } });
      });
    } else if(e.hasLast){
      setTimeout(function(){ if(e.subs.indexOf(sub) !== -1){ try{ cb(e.last); }catch(x){ if(window.console) console.error('snapshot callback', name, x); } } }, 0);
    }
    return function(){
      var i = e.subs.indexOf(sub); if(i !== -1) e.subs.splice(i, 1);
      if(!e.subs.length && e.unsub){ try{ e.unsub(); }catch(x){} e.unsub = null; e.hasLast = false; e.last = null; }
    };
  }
  function wrap(db){
    if(!db || typeof Proxy === 'undefined') return db;
    return new Proxy(db, { get: function(t, k){
      if(k === 'collection') return function(name){
        var real = t.collection(name);
        return new Proxy(real, { get: function(c, m){
          if(m === 'onSnapshot') return function(cb, errCb){ return subscribe(name, c, cb, errCb); };
          var v = c[m]; return typeof v === 'function' ? v.bind(c) : v;
        } });
      };
      var v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
  }
  window.hubDb = function(){
    if(!(window.claude && window.claude.use)) return Promise.resolve(null);
    return window.claude.use('db').then(function(db){ if(!db) return db; if(!wrapped || wrapped.raw !== db) wrapped = { raw: db, db: wrap(db) }; return wrapped.db; });
  };
})();
</script>
JS
i = s.index('<script') or abort('noscript')
s[i...i] = shared_js
s.gsub!("window.claude.use('db')", "window.hubDb()")
s.gsub!("claude.use('db')", "window.hubDb()")
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v228.html","hub_v229.html")
open('v216.rb','w',encoding='utf-8').write(r)
