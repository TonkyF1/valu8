import json, numpy as np, pandas as pd, os
W = os.environ["WORK"]
pm = pd.read_csv(f"{W}/pm_hold.csv"); oc = pd.DataFrame(json.load(open(f"{W}/{os.environ.get('OCF','oc_hold.json')}")))
D = pm.merge(oc, on="id"); D["dl"] = D.seller == "dealer"
D["pm"] = np.where(D.dl, D.pm_dealer, D.pm_priv); D["oo"] = np.where(D.dl, D.oo_dealer, D.oo_priv); D["on"] = np.where(D.dl, D.on_dealer, D.on_priv)
D["e_old"] = np.exp(0.7*np.log(D.pm)+0.3*np.log(D.oo)); D["e_newoc"] = np.exp(0.7*np.log(D.pm)+0.3*np.log(D.on))
D.to_pickle(f"{W}/D.pkl")
def m(col, g): e = np.abs(g[col]/g.price-1)*100; return f"{np.median(e):5.1f}"
for s in ["A","B"]:
    g = D[D.split==s]; print(s, len(g), {c: m(c,g) for c in ["pm","oo","on","e_old","e_newoc"]})
    for k, gg in g.groupby("seller"): print("   ", k, len(gg), {c: m(c,gg) for c in ["pm","oo","on","e_old","e_newoc"]})
