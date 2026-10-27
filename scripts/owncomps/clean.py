import pandas as pd, json, re, numpy as np
import os
HERE=os.path.dirname(os.path.abspath(__file__)); WORK=os.environ.get('WORK','/tmp/owncomps')
d=pd.read_csv(os.path.join(WORK,'listings.csv'))
n0=len(d); log={}
MULTI=['land rover','mercedes-benz','mercedes benz','alfa romeo','aston martin','mini']
def norm_make(m):
    m=str(m).strip().lower().replace('mercedes benz','mercedes-benz')
    return {'vw':'volkswagen','mercedes':'mercedes-benz'}.get(m,m)
rows=[]
for r in d.to_dict('records'):
    if pd.isna(r['make']):  # valu8_tests rows: full title in model
        t=str(r['model']).strip(); tl=t.lower()
        mk=next((m for m in MULTI if tl.startswith(m)),tl.split(' ')[0])
        rest=t[len(mk):].strip().split(' ')
        r['make']=mk; r['model']=rest[0] if rest else ''; r['variant']=' '.join(rest[1:])
        if re.search(r'diesel|tdi|dci|\bd\b|\d{3}d\b|crdi|hdi|cdti',tl): r['fuel']='Diesel'
        elif re.search(r'hybrid',tl): r['fuel']='Hybrid Electric'
        else: r['fuel']='Petrol'
        r['gearbox']='Automatic' if re.search(r'auto|cvt|dsg|tiptronic',tl) else 'Manual'
    rows.append(r)
d=pd.DataFrame(rows)
d['make']=d.make.map(norm_make)
def norm_model(mk,m,v):
    m=str(m).lower().strip().replace('-class',' class').replace('_',' ')
    m=re.sub(r'\s+',' ',m)
    if mk=='mini' and m in('hatchback','hatch','cooper','one','convertible'): m='hatch'
    if mk=='vauxhall' and m=='gtc': m='astra gtc'
    if mk=='bmw' and re.fullmatch(r'[1-5]\d\d[a-z]{0,2}',m): m=m[0]+' series'
    if mk=='mercedes-benz' and re.fullmatch(r'[a-z]\d{3}[a-z]?',m): m=m[0]+' class'
    m=m.replace('mx5','mx-5')
    return m
d['model']=[norm_model(a,b,c) for a,b,c in zip(d.make,d.model,d.variant)]
d['variant']=d.variant.fillna('').astype(str).str.strip()
d['fuel']=d.fuel.fillna('Petrol').str.lower().str.replace('hybrid electric','hybrid')
d['gearbox']=d.gearbox.fillna('Manual').str.lower().replace({'semi-auto':'automatic'})
# Gumtree "Other" gearbox is mostly automatics (~93% private ads); left as-is it was encoded manual, biasing
# those ads ~-28%. Resolve from the ad text; "other" is automatic unless the text says manual. Also fix manual-labelled
# rows whose model/variant text names an automatic box (e.g. "estima 2wd auto").
_AUTO=r'\bauto(?:matic)?\b|\bdsg\b|\bcvt\b|tiptronic|s[- ]?tronic|steptronic|powershift|\bdct\b|semi[- ]?auto|\bedc\b|\bamt\b|multitronic|easytronic|dualogic|\bpdk\b'
_MAN=r'\bmanual\b|\b[56][- ]?speed\b|\bstick\b'
_mv=(d.model.fillna('').astype(str)+' '+d.variant.fillna('').astype(str))
_txt=(_mv+' '+d['desc'].fillna('').astype(str))
_a=_txt.str.contains(_AUTO,case=False,regex=True); _m=_txt.str.contains(_MAN,case=False,regex=True)
_o=d.gearbox.eq('other')
d.loc[_o&_m,'gearbox']='manual'; d.loc[_o&~_m,'gearbox']='automatic'
log['gearbox_other_resolved']=int(_o.sum())
_fx=d.gearbox.eq('manual')&_mv.str.contains(_AUTO,case=False,regex=True)
d.loc[_fx,'gearbox']='automatic'; log['gearbox_manual_text_auto']=int(_fx.sum())
for c in ['year','mileage','price']: d[c]=pd.to_numeric(d[c],errors='coerce')
bad=~d.seller.isin(['dealer','private']) | ~d.year.between(1985,2026) | ~(d.price>=300) | (d.price>=150000) | d.mileage.isna() | (d.mileage>350000)
log['malformed_or_impossible']=int(bad.sum()); d=d[~bad].copy()
d['year']=d.year.astype(int); d['mileage']=d.mileage.astype(int)
# implausible mileage on a 3+ year-old car (typically entered in thousands: '71' = 71k); its true mileage is unknown -> drop
lm=(d.mileage<1000)&(d.year<=2023)
log['implausible_low_mileage']=int(lm.sum()); d=d[~lm]
# placeholder prices like 123456 / 1234 / 99999
ph=d.price.isin([1234,12345,123456,99999,999999,11111])
log['placeholder_price']=int(ph.sum()); d=d[~ph]
dup=d.duplicated('id')|d.duplicated(['make','model','year','mileage','price'])
log['duplicates']=int(dup.sum()); d=d[~dup]
held=set(json.load(open(os.path.join(HERE,'held_ids.json'))))
d['held']=d.id.isin(held)
d['bad_cond']=d.cat_sn|d.non_runner|d.no_mot
# outliers: robust residual vs make+age log-price, flagged after a crude fit
d['age']=2026-d.year
d['lp']=np.log(d.price)
X=np.c_[np.ones(len(d)),d.age,np.log1p(d.mileage/1e4)]
cl=~d.bad_cond&~d.held
b=np.linalg.lstsq(X[cl],d.lp[cl],rcond=None)[0]
res=d.lp-X@b
# within model group robust z
d['res']=res
d.loc[d.held,'res']=np.nan
grp=d.groupby(['make','model']).res
med=grp.transform('median'); mad=grp.transform(lambda s:(s-s.median()).abs().median()).fillna(0)
cnt=grp.transform('size')
z=(d.res-med)/(1.4826*mad.clip(lower=0.15))
out=~d.held&((cnt>=4)&(z.abs()>3.5)) | ((d.res-np.median(res)).abs()>2.0)
log['outliers']=int(out.sum()); d=d[~out]
log['in']=n0; log['out']=len(d); log['bad_condition_kept_flagged']=int(d.bad_cond.sum())
log['held_remaining']=int(d.held.sum())
cols=['id','make','model','variant','year','mileage','fuel','gearbox','seller','price','cat_sn','non_runner','no_mot','fsh','held','search_tag','desc']
d['desc']=d.desc.fillna('').astype(str).str.slice(0,160)
d[cols].to_json(os.path.join(WORK,'clean.json'),orient='records')
print(json.dumps(log,indent=1)); print(d.make.value_counts().head(8).to_dict())
