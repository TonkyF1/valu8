"""pm-1.1: retrain pm-1 (same features/params) on the pm-1 train rows + new harvest rows (dedupe.py -> new_pool.json).
Eval A: the ORIGINAL stratified held-out set (scripts/owncomps/strat_test_ids.json, commit f675ad6), body filled from the
train-only make|model body mode (as in round2/bodyfill.py), vs pm-1 retrained identically on its own train set.
Eval B: fresh holdout = newest 20% (by Gumtree id) per band|seller stratum of the NEW rows (both models exclude them).
Range: conformal OOF q10/q90 by predBand|seller, thin cells with n<30 (thin) shrunk to the band (itself shrunk to global) quantiles: q=(n*q_cell+K*q_parent)/(n+K), K=30;
lo/hi clamped to <=-3%/>=+3% so the range always contains the point price (fixes pm-1 private 40k+: 5 cars, lower bound +0.3%).
Env: OLD_CLEAN (pm-1 clean.json), RAW (harvest csv with engine_cc/body), NEW_POOL, TEST_IDS, BODY_MODE, OC_PREDS, EXPORT=1 -> TS_OUT, PARITY_OUT."""
import os, json, sys, numpy as np, pandas as pd, lightgbm as lgb
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))  # features.py / export.py
from features import base_frame, TargetEnc, oof_te, NUM
E = os.environ; VERSION = E.get("VERSION", "pm-1.1"); KSH = int(E.get("RANGE_K", 30)); MIN_N = int(E.get("RANGE_MIN_N", 30))
h = pd.read_csv(E["RAW"]); h["id"] = "gt" + h.listing_id.astype(str); h = h.drop_duplicates("id")
o = pd.read_json(E["OLD_CLEAN"]).merge(h[["id", "engine_cc", "body"]], on="id", how="left").set_index("id", drop=False)
nw = pd.read_json(E["NEW_POOL"]).merge(h[["id", "engine_cc", "body"]], on="id", how="left").set_index("id", drop=False)
test_ids = set(json.load(open(E["TEST_IDS"]))); mode = json.load(open(E["BODY_MODE"]))
pool = o[o.id.str.startswith("gt") & (o.search_tag == "harvest") & ~o.non_runner & ~o.held & (o.price >= 300)]
JUNK = r"\bdeposit\b|per month|\bp/?m\b|\bpcm\b|£\s?\d+\s?(?:pm|a month)|for parts|parts only"
def clean_train(t):
    j = t.desc.fillna("").str.lower().str.contains(JUNK, regex=True) & (t.price < 2500); return t[~j]
P = dict(objective="regression", learning_rate=0.04, num_leaves=31, min_data_in_leaf=20, feature_fraction=0.8, bagging_fraction=0.8,
         bagging_freq=1, lambda_l2=1.0, verbose=-1, seed=1, num_threads=8)
def fit(t):
    f = base_frame(t); y = np.log(t.price.values); X = pd.concat([f[NUM], oof_te(f, y)], axis=1).astype(float)
    return lgb.train(P, lgb.Dataset(X, y), 900), TargetEnc().fit(f, y)
def predict(m, te, t):
    f = base_frame(t); return np.exp(m.predict(pd.concat([f[NUM], te.transform(f)], axis=1).astype(float)))
BN = ["<2k", "2-5k", "5-10k", "10-20k", "20-40k", "40k+"]; band = lambda p: BN[int(np.searchsorted([2000, 5000, 10000, 20000, 40000], p, side="right"))]
fillb = lambda t: t.assign(body=(t.make.str.lower() + "|" + t.model.str.lower()).map(mode).fillna(""))
def strat(price, pred, seller):
    e = np.abs(pred - price) / price * 100; r = pd.DataFrame({"e": e, "b": [band(p) for p in price], "s": seller})
    o = {"n": int(len(e)), "overall": round(float(np.median(e)), 2)}
    for k, g in r.groupby("b"): o["band:" + k] = [round(float(np.median(g.e)), 2), int(len(g))]
    for k, g in r.groupby("s"): o["seller:" + k] = [round(float(np.median(g.e)), 2), int(len(g))]
    return o
# ---- data splits
old_tr = clean_train(pool[~pool.id.isin(test_ids)]); ts = pool[pool.id.isin(test_ids)]
nw = nw[~nw.id.isin(test_ids)]; nw["g"] = [band(p) + "|" + s for p, s in zip(nw.price, nw.seller)]
nw["gid"] = nw.id.str[2:].astype(int); fresh = set()
for _, x in nw.groupby("g"): x = x.sort_values("gid"); fresh |= set(x.id.iloc[int(np.floor(len(x) * 0.8)):])
fr = nw[nw.id.isin(fresh)]; new_tr = clean_train(nw[~nw.id.isin(fresh)])
print("old_train", len(old_tr), "test", len(ts), "new_train", len(new_tr), "fresh", len(fr), file=sys.stderr)
# ---- models
m0, te0 = fit(old_tr); tr1 = pd.concat([old_tr, new_tr]); m1, te1 = fit(tr1)
def qtable(tr, oof):
    res = pd.DataFrame({"b": [band(p) for p in oof], "s": tr.seller.values, "lr": np.log(tr.price.values / oof)})
    q = lambda x: [float(np.quantile(x, 0.1)), float(np.quantile(x, 0.9)), int(len(x))]
    G = q(res.lr); Bq = {b: q(x.lr) for b, x in res.groupby("b")}; R = {}; raw = {}
    for (b, s), x in res.groupby(["b", "s"]):
        c = q(x.lr); raw[b + "|" + s] = c; pb = Bq[b]
        pb = [(pb[2] * pb[0] + KSH * G[0]) / (pb[2] + KSH), (pb[2] * pb[1] + KSH * G[1]) / (pb[2] + KSH)]  # band shrunk to global
        if c[2] >= MIN_N: lo, hi = c[0], c[1]  # well-populated cell: its own quantiles
        else: lo = (c[2] * c[0] + KSH * pb[0]) / (c[2] + KSH); hi = (c[2] * c[1] + KSH * pb[1]) / (c[2] + KSH)  # thin: shrink to parent
        R[b + "|" + s] = [round(min(lo, -0.03), 4), round(max(hi, 0.03), 4), c[2]]
    R["*"] = [round(G[0], 4), round(G[1], 4), G[2]]; return R, raw
def oof_preds(tr):
    k = np.random.RandomState(7).randint(0, 5, len(tr)); oof = np.zeros(len(tr))
    for i in range(5): mi, tei = fit(tr[k != i]); oof[k == i] = predict(mi, tei, tr[k == i])
    return oof
def cover(R, t, pred):
    qq = np.array([R.get(band(p) + "|" + s, R["*"])[:2] for p, s in zip(pred, t.seller)])
    lr = np.log(t.price.values / pred); inn = (lr >= qq[:, 0]) & (lr <= qq[:, 1])
    g = pd.Series(inn).groupby([band(p) + "|" + s for p, s in zip(pred, t.seller)])
    return {"coverage_pct": round(float(inn.mean() * 100), 1), "median_width_pct": round(float(np.median(np.exp(qq[:, 1]) - np.exp(qq[:, 0])) * 100), 1),
            "bySeller": {s: round(float(inn[(t.seller == s).values].mean() * 100), 1) for s in ["dealer", "private"]},
            "byCell": {k: [round(float(v.mean() * 100), 1), int(len(v))] for k, v in g}}
out = {"version": VERSION, "train_pm1": len(old_tr), "train_pm11": len(tr1), "new_train_rows": len(new_tr), "fresh_holdout": len(fr), "evalA_original_holdout": {}, "evalB_fresh_holdout": {}}
tsf, frf = fillb(ts), fillb(fr); P = {}
for nm, m, te in [("pm-1", m0, te0), (VERSION, m1, te1)]:
    P[nm] = (predict(m, te, tsf), predict(m, te, frf))
    out["evalA_original_holdout"][nm] = strat(ts.price.values, P[nm][0], ts.seller.values)
    out["evalB_fresh_holdout"][nm] = strat(fr.price.values, P[nm][1], fr.seller.values)
if E.get("OC_PREDS"):
    oc = pd.DataFrame(json.load(open(E["OC_PREDS"]))).set_index("id").pred.reindex(ts.id).values; ok = np.isfinite(oc) & (oc > 0)
    for nm in P:
        b = np.where(ok, P[nm][0] ** 0.7 * np.where(ok, oc, 1) ** 0.3, P[nm][0])
        out["evalA_original_holdout"][nm + "+oc(0.7/0.3)"] = strat(ts.price.values, b, ts.seller.values)
# ranges: pm-1 cells (old method, unshrunk) vs pm-1.1 shrunk
oof0 = oof_preds(old_tr); R0s, raw0 = qtable(old_tr, oof0); R0 = {**{k: [round(v[0], 4), round(v[1], 4), v[2]] for k, v in raw0.items()}}
R0["*"] = R0s["*"]
oof1 = oof_preds(tr1); R1, raw1 = qtable(tr1, oof1)
out["range"] = {"method": f"conformal OOF q10/q90 by predBand|seller; cells with n<{MIN_N} shrunk to band->global quantiles (K={KSH}); lo<=-3%, hi>=+3%", "nominal": 80,
    "pm-1_unshrunk": {"table": R0, "A": cover(R0, ts, P["pm-1"][0]), "B": cover(R0, fr, P["pm-1"][1])},
    "pm-1_shrunk": {"table": R0s, "A": cover(R0s, ts, P["pm-1"][0]), "B": cover(R0s, fr, P["pm-1"][1])},
    VERSION: {"table": R1, "A": cover(R1, ts, P[VERSION][0]), "B": cover(R1, fr, P[VERSION][1])}}
# promotion gate: beats pm-1 overall on A, no stratum (band/seller) worse by >1pt
a0, a1 = out["evalA_original_holdout"]["pm-1"], out["evalA_original_holdout"][VERSION]
worst = max(a1[k][0] - a0[k][0] for k in a0 if ":" in k)
out["gate"] = {"overall_delta": round(a1["overall"] - a0["overall"], 2), "worst_stratum_delta": round(worst, 2), "promote": bool(a1["overall"] < a0["overall"] and worst <= 1.0)}
json.dump(out, open(E.get("OUT", "pm11_eval.json"), "w"), indent=1)
print(json.dumps({k: out[k] for k in ("evalA_original_holdout", "evalB_fresh_holdout", "gate")}, indent=0))
if E.get("EXPORT"):
    # production pm-1.1: old train + ALL new usable rows (fresh holdout included); original held-out ids stay excluded
    full = pd.concat([old_tr, clean_train(nw)]); mp, tep = fit(full); oofp = oof_preds(full); Rp, _ = qtable(full, oofp)
    from export import compact, write_ts
    write_ts(compact(mp, tep, Rp, VERSION), E["TS_OUT"], VERSION)
    fx = ts.sample(200, random_state=3); pf = predict(mp, tep, fx)
    cols = ["make", "model", "variant", "year", "mileage", "fuel", "gearbox", "body", "engine_cc", "seller", "desc"]
    json.dump([{**{c: (None if pd.isna(v) else (v.item() if hasattr(v, "item") else v)) for c, v in zip(cols, row)}, "py": round(float(p), 2)}
               for row, p in zip(fx[cols].itertuples(index=False), pf)], open(E["PARITY_OUT"], "w"))
    json.dump({"train_rows": len(full), "range": Rp, "cover_fresh_in_sample_note": "fresh rows are in this model's training set"}, open(E.get("OUT", "pm11_eval.json").replace(".json", "_prod.json"), "w"), indent=1)
    print("exported", len(full), file=sys.stderr)
