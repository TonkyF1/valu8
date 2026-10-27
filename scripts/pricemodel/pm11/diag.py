# diagnostics for pm-1.1 not promoting: bias of new rows, seed noise, down-weighted new rows
import os; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "train11.py")).read().split("# ---- models")[0])
def fitw(t, w, seed=1):
    f = base_frame(t); y = np.log(t.price.values); X = pd.concat([f[NUM], oof_te(f, y)], axis=1).astype(float)
    return lgb.train({**P, "seed": seed}, lgb.Dataset(X, y, weight=w), 900), TargetEnc().fit(f, y)
tsf, frf = fillb(ts), fillb(fr)
m0, te0 = fitw(old_tr, None); p0 = predict(m0, te0, frf)
print("pm-1 signed median on fresh", np.median(np.log(p0 / fr.price)), "on A", np.median(np.log(predict(m0, te0, tsf) / ts.price)))
print("new rows band mix", pd.Series([band(p) for p in nw.price]).value_counts(normalize=True).round(3).to_dict())
print("old train band mix", pd.Series([band(p) for p in old_tr.price]).value_counts(normalize=True).round(3).to_dict())
print("new age median", (2026 - nw.year).median(), "old", (2026 - old_tr.year).median(), "dealer share new", (nw.seller == "dealer").mean(), "old", (old_tr.seller == "dealer").mean())
tr1 = pd.concat([old_tr, new_tr])
for seed in [1, 2, 3]:
    for w in [1.0, 0.5]:
        if seed > 1 and w != 1.0: continue
        m, te = fitw(tr1, np.r_[np.ones(len(old_tr)), np.full(len(new_tr), w)], seed)
        a = strat(ts.price.values, predict(m, te, tsf), ts.seller.values); b = strat(fr.price.values, predict(m, te, frf), fr.seller.values)
        print("seed", seed, "w", w, "A", a["overall"], "B", b["overall"])
    if seed > 1:
        m, te = fitw(old_tr, None, seed); print("seed", seed, "pm-1 A", strat(ts.price.values, predict(m, te, tsf), ts.seller.values)["overall"])
