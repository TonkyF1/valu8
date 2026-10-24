# Price effect of MOT/condition proxy flags at matched make/model/age/mileage: fit pm without ANY text flags (5-fold OOF on train+test pool),
# then median log residual of rows carrying a flag (vs 0 for the rest), by price band. Bootstrap CI.
from common import *
from feats2 import frame2, NEW
import features as Fm
FL = list(Fm.TEXT) + list(NEW)
base_num = [k for k in NUM if k not in Fm.TEXT]
allp = pd.concat([tr, ts]); k = np.random.RandomState(3).randint(0, 5, len(allp)); oof = np.zeros(len(allp))
for i in range(5):
    m, te = fit(allp[k != i], frame2, base_num, 600); oof[k == i] = predict(m, te, allp[k == i], frame2, base_num)
f = frame2(allp); lr = np.log(allp.price.values / oof); lr = lr - np.median(lr)
bands = np.where(oof < 2000, "<2k", np.where(oof < 5000, "2-5k", "5k+")); rng = np.random.RandomState(0); out = {}
for fl in FL + ["owners>=4"]:
    on = (f.owners.values >= 4) if fl == "owners>=4" else f[fl].values == 1
    row = {}
    for b in ["all", "<2k", "2-5k", "5k+"]:
        sel = on & ((bands == b) if b != "all" else True); x = lr[sel]
        if len(x) < 15: row[b] = {"n": int(len(x))}; continue
        bs = [np.median(rng.choice(x, len(x))) for _ in range(300)]
        row[b] = {"n": int(len(x)), "pct": round((np.exp(np.median(x)) - 1) * 100, 1), "ci": [round((np.exp(q) - 1) * 100, 1) for q in np.percentile(bs, [5, 95])]}
    out[fl] = row
json.dump(out, open("effects.json", "w"), indent=1)
for fl, r in out.items(): print(fl.ljust(12), "  ".join(f"{b}: n={v['n']} {v.get('pct','')}% {v.get('ci','')}" for b, v in r.items()))
