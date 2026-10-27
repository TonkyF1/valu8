# Evaluate own-comps variants (OCF files) through ens-2 with the shipped (fixed) theta on held-out A and B.
import json, os, sys, numpy as np, pandas as pd
sys.argv=[sys.argv[0]]; W = os.environ["WORK"]
_src = open(os.path.join(os.path.dirname(__file__), "ens2_fit.py")).read(); exec(_src[_src.index("def X_of"):_src.index("def fit(")])
th0 = json.load(open(f"{W}/ens2_fit.json"))["theta"]; TH = np.array(list(th0.values()))
pm = pd.read_csv(f"{W}/pm_hold.csv")
def build(ocf):
    oc = pd.DataFrame(json.load(open(f"{W}/{ocf}"))); D = pm.merge(oc, on="id"); D["dl"] = D.seller == "dealer"
    D["pm"] = np.where(D.dl, D.pm_dealer, D.pm_priv); D["on"] = np.where(D.dl, D.on_dealer, D.on_priv); return D
def med(e): return round(float(np.median(e)), 2) if len(e) else None
def report(D, p, lab):
    out = {}
    for s in "AB":
        m = (D.split == s).values; e = np.abs(np.exp(p[m]) / D.price.values[m] - 1) * 100; d = D[m]
        cheap = (d.price < 5000).values; dl = d.dl.values
        out[s] = {"all": med(e), "private": med(e[~dl]), "dealer": med(e[dl]), "5-20k": med(e[((d.price >= 5000) & (d.price < 20000)).values]),
                  "dealer<5k": med(e[dl & cheap]), "private<5k": med(e[~dl & cheap]), "o30": round(float(np.mean(e > 30) * 100), 1),
                  "oc_dealer<5k": med(np.abs(d.on.values[dl & cheap] / d.price.values[dl & cheap] - 1) * 100)}
    print(lab, json.dumps(out)); return out
if __name__ == "__main__":
    for ocf in os.environ["OCFS"].split(","):
        D = build(ocf); p = pred(TH, *X_of(D))[0]; report(D, p, ocf)
