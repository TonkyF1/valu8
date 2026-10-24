import os, json, numpy as np, pandas as pd  # WORK=<strat work dir> AI_OC=<hyb/oc.json own-comps preds for the AI cases>
a = pd.read_csv(os.environ["WORK"] + "/pm_ai_cases.csv"); o = pd.DataFrame(json.load(open(os.environ["AI_OC"]))).drop_duplicates("id")
d = a.merge(o[["id", "oc", "level", "n", "conf"]], on="id", how="left"); print(len(d), d.oc.notna().sum())
def cap(r):
    if r.level == "model" and r.n >= 50 and r.conf >= 0.6 and r.ai > 1.8 * r.oc: return round(1.6 * r.oc / 50) * 50
    return r.ai
d["aic"] = d.apply(cap, axis=1); d = d[d.oc.notna()]
lp, lpm, loc_, lai = np.log(d.price_b), np.log(d.pm), np.log(d.oc), np.log(d.aic)
base = 0.7 * lpm + 0.3 * loc_
e = lambda x: np.median(np.abs(np.exp(x - lp) - 1)) * 100
print("pm", e(lpm), "oc", e(loc_), "ai+cap", e(lai), "blend", e(base))
for w in [0, .1, .2, .3, .4, .5]: print("w_ai", w, round(e((1 - w) * base + w * lai), 1))
# leave-one-out choice of w_ai
W = np.arange(0, .61, .05); loo = []
for i in range(len(d)):
    m = np.ones(len(d), bool); m[i] = False
    wb = W[np.argmin([np.median(np.abs(np.exp(((1 - w) * base + w * lai)[m] - lp[m]) - 1)) for w in W])]
    loo.append(abs(np.exp((1 - wb) * base.iloc[i] + wb * lai.iloc[i] - lp.iloc[i]) - 1))
print("LOO-chosen w_ai err", round(np.median(loo) * 100, 1))
# bootstrap: how often does w=0.2 beat w=0 ?
r = np.random.RandomState(0); wins = 0
for _ in range(2000):
    ii = r.randint(0, len(d), len(d)); wins += e(((0.8) * base + 0.2 * lai).iloc[ii] + 0 * lp.iloc[ii]) < 0  # placeholder
for w in [.6, .7, .8, .9, 1.0]: print("w_ai", w, round(e((1 - w) * base + w * lai), 1))
W = np.arange(0, 1.01, .05); loo = []
for i in range(len(d)):
    m = np.ones(len(d), bool); m[i] = False
    wb = W[np.argmin([np.median(np.abs(np.exp(((1 - w) * base + w * lai)[m] - lp[m]) - 1)) for w in W])]; loo.append(abs(np.exp((1 - wb) * base.iloc[i] + wb * lai.iloc[i] - lp.iloc[i]) - 1))
print("LOO w in 0..1 err", round(np.median(loo) * 100, 1)); print(d.assign(r_ai=d.aic/d.price_b, r_pm=d.pm/d.price_b).describe().round(2))
