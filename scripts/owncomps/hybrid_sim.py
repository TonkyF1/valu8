import json,math,os,random,statistics as st
oc={(r['split'],r['id']):r for r in json.load(open(os.environ.get('WORK','/tmp/owncomps')+'/hybrid_oc.json'))}
B=[b for b in json.load(open(os.path.join(os.path.dirname(__file__),'results_baseline.json'))) if b.get('src')=='ai_estimate' and b.get('pred')]
rows=[]
for b in B:
  o=oc.get(('all',b['id']))
  if o: rows.append(dict(price=b['price'],ai=b['pred'],oc=o['oc'],priv=o['priv'],lvl=o['level'],n=o['n'],conf=o['conf'],seller=b['seller'],split=b['split']))
print('paired rows',len(rows))
r50=lambda x:round(x/50)*50
def conf(r,n=50,c=0.6): return r['lvl']=='model' and r['n']>=n and r['conf']>=c
def capped(r):
  a=r['ai']
  if conf(r) and a>1.8*r['priv']: a=r50(1.6*r['priv'])
  return a
rules={
 'AI alone':lambda r:r['ai'],
 'AI + live cap (prod)':capped,
 'own-comps alone':lambda r:r['oc'],
 'OC if confident(n50,c.6) else AIcap':lambda r:r['oc'] if conf(r) else capped(r),
 'OC if confident(n20,c.4) else AIcap':lambda r:r['oc'] if conf(r,20,.4) else capped(r),
 'blend 50/50':lambda r:r50((r['ai']+r['oc'])/2),
 'geo-mean':lambda r:r50(math.sqrt(r['ai']*r['oc'])),
 'blend 70OC/30AI':lambda r:r50(.7*r['oc']+.3*r['ai']),
 'blend 30OC/70AI':lambda r:r50(.3*r['oc']+.7*r['ai']),
 'AI for private OC<3k else OC':lambda r:r['ai'] if (r['seller']=='private' and r['oc']<3000) else r['oc'],
 'confident: 50/50 blend else AIcap':lambda r:r50((r['ai']+r['oc'])/2) if conf(r) else capped(r),
 'clamp AI to OC x[0.7,1.4]':lambda r:min(max(r['ai'],.7*r['oc']),1.4*r['oc']),
}
def err(f): return [abs(f(r)-r['price'])/r['price']*100 for r in rows]
base=err(rules['AI + live cap (prod)'])
random.seed(1)
print(f"{'rule':40s} med  mean w15 w25 | vs prod: wins/losses  boot P(med better)")
for k,f in rules.items():
  e=err(f); w=sum(a<b-1e-9 for a,b in zip(e,base)); l=sum(a>b+1e-9 for a,b in zip(e,base))
  idx=range(len(rows)); better=0
  for _ in range(2000):
    s=[random.choice(idx) for _ in idx]; better+= st.median([e[i] for i in s])<st.median([base[i] for i in s])
  print(f"{k:40s} {st.median(e):5.1f} {st.mean(e):5.1f} {sum(x<=15 for x in e)*100//len(e):3d} {sum(x<=25 for x in e)*100//len(e):3d} | {w:2d}/{l:2d}  {better/2000:.2f}")
print('confident cases', sum(conf(r) for r in rows), 'private', sum(r['seller']=='private' for r in rows))
