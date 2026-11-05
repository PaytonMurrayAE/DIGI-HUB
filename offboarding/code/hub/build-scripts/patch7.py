r=open('v216.rb',encoding='utf-8').read()
block = r'''
# ---- Goals: a goal for a future year tracks where we are now ----
rep.("        if(y === Y) return counted.filter(function(a){ return !isCanc(a.id); }).length;", "        if(y >= Y) return counted.filter(function(a){ return !isCanc(a.id); }).length;")
rep.("var mm = y === Y ? now.getMonth() + 1 : y < Y ? 12 : null; if(mm == null) return null;", "var yy = y > Y ? Y : y, mm = yy === Y ? now.getMonth() + 1 : 12;")
rep.("var v = st(a.id, y, mm); if(!v || v === 'cancelled'", "var v = st(a.id, yy, mm); if(!v || v === 'cancelled'")
rep.("var sd = spend[y + '-' + (mm < 10", "var sd = spend[yy + '-' + (mm < 10")
'''
r=r.replace("s.sub!(/HUB_BUILD", block+"s.sub!(/HUB_BUILD",1).replace("hub_v225.html","hub_v226.html")
open('v216.rb','w',encoding='utf-8').write(r)
