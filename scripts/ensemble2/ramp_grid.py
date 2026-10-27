# Grid over the cheap-car dealer add-on ramp (pred-side only), chosen on A, checked on B. Uses ens-2 with shipped theta.
import json, os, numpy as np, pandas as pd
W = os.environ["WORK"]; exec(open(os.path.join(os.path.dirname(__file__), "eval_variant.py")).read().split('if __name__')[0])
D0 = build("oc_hold.json")
def dealer(p, lo, hi): r = np.clip((p - lo) / max(hi - lo, 1), 0, 1) if hi > 0 else 1; return np.round((p * 1.1 + 1500 * r) / 50) * 50
for lo, hi in [(0, 0), (0, 2000), (0, 3000), (400, 3000), (800, 3000), (800, 4000), (1200, 3000), (500, 2500), (0, 4000), (1000, 5000)]:
    D = D0.copy(); D["on_dealer"] = dealer(D.on_priv.values, lo, hi); D["on"] = np.where(D.dl, D.on_dealer, D.on_priv)
    p = pred(TH, *X_of(D))[0]; o = {}
    for s in "AB":
        m = ((D.split == s) & D.dl).values; e = np.abs(np.exp(p[m]) / D.price.values[m] - 1) * 100; c = D.price.values[m] < 5000
        o[s] = (round(float(np.median(e)), 2), round(float(np.median(e[c])), 2), round(float(np.mean(e[c] > 30) * 100), 1))
    print(lo, hi, "dealer all / <5k / <5k o30:", o)
