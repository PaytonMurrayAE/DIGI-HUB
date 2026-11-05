// In-memory stand-in for window.claude.use('db') so the Hub can be tested locally.
(function(){
  var store = {}, subs = {}, seq = 0;
  function col(name){ return store[name] = store[name] || {}; }
  function snap(name){ var c = col(name); return { empty: !Object.keys(c).length, docs: Object.keys(c).map(function(id){ return { id: id, exists: true, data: function(){ return JSON.parse(JSON.stringify(c[id])); } }; }) }; }
  function notify(name){ (subs[name] || []).forEach(function(f){ try{ f(snap(name)); }catch(e){ console.error('snapshot cb', e); } }); }
  window.__mockSubCount = function(){ var t = 0, d = {}; Object.keys(subs).forEach(function(k){ d[k] = subs[k].length; t += subs[k].length; }); return { total: t, by: d }; };
  function query(name, o){
    o = o || {};
    function run(){ var snapd = snap(name), docs = snapd.docs.slice(); if(o.order){ docs.sort(function(x, y){ var a = x.data()[o.order[0]], b = y.data()[o.order[0]]; return (a > b ? 1 : a < b ? -1 : 0) * (o.order[1] === 'desc' ? -1 : 1); }); } if(o.lim) docs = docs.slice(0, o.lim); return { empty: !docs.length, docs: docs }; }
    var q = {
      orderBy: function(f, d){ return query(name, { order: [f, d || 'asc'], lim: o.lim }); },
      limit: function(n){ return query(name, { order: o.order, lim: n }); },
      where: function(){ return query(name, o); },
      onSnapshot: function(f, ef){ var fl = ''; try{ fl = localStorage.getItem('__failSnap') || ''; }catch(e){} if(fl.split(',').indexOf(name) !== -1){ setTimeout(function(){ if(ef) ef(new Error('simulated listener failure')); }, 0); return function(){}; } (subs[name] = subs[name] || []).push(function(){ try{ f(run()); }catch(e){ console.error('snapshot cb', e); } }); setTimeout(function(){ try{ f(run()); }catch(e){ console.error('snapshot cb', e); } }, 0); return function(){}; },
      get: function(){ return Promise.resolve(run()); }
    };
    return q;
  }
  function collection(name){
    var q = query(name);
    return {
      orderBy: q.orderBy, limit: q.limit, where: q.where,
      onSnapshot: function(f){ (subs[name] = subs[name] || []).push(f); setTimeout(function(){ try{ f(snap(name)); }catch(e){ console.error('snapshot cb', e); } }, 0); return function(){}; },
      get: function(){ return Promise.resolve(snap(name)); },
      add: function(d){ var id = 'auto' + (++seq); col(name)[id] = JSON.parse(JSON.stringify(d)); notify(name); return Promise.resolve({ id: id }); },
      doc: function(id){
        return {
          id: id,
          get: function(){ var c = col(name); return Promise.resolve({ id: id, exists: id in c, data: function(){ return id in c ? JSON.parse(JSON.stringify(c[id])) : undefined; } }); },
          set: function(d){ col(name)[id] = JSON.parse(JSON.stringify(d)); notify(name); return Promise.resolve(); },
          update: function(d){ var c = col(name); if(!(id in c)) return Promise.reject(new Error('missing')); c[id] = Object.assign({}, c[id], JSON.parse(JSON.stringify(d))); notify(name); return Promise.resolve(); },
          delete: function(){ delete col(name)[id]; notify(name); return Promise.resolve(); }
        };
      }
    };
  }
  // like the real runtime, the namespace and collections are frozen
  var db = Object.freeze({ collection: function(n){ return Object.freeze(collection(n)); } });
  window.claude = { use: function(name){ if(name === 'db') return Promise.resolve(db); if(name === 'user') return Promise.resolve({ canEdit: function(){ return true; }, isOwner: function(){ return true; } }); return Promise.resolve(null); } };
})();
