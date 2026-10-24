"""Train + evaluate the pm-1 LightGBM price model on the harvest, on the SAME stratified time-split held-out set as
own-comps (scripts/owncomps/strat_test_ids.json), plus the 32 AI-estimate baseline cases. WORK needs clean.json (clean.py)
and RAW (harvest listings.csv.gz) for engine_cc/body. Writes $WORK/pm_eval.json, $WORK/pm_preds.csv, $WORK/pm_model.json."""
import os, json, sys, numpy as np, pandas as pd, lightgbm as lgb
sys.path.insert(0, os.path.dirname(__file__)); from features import base_frame, TargetEnc, oof_te, NUM, TE
HERE = os.path.dirname(os.path.abspath(__file__)); OC = os.path.join(HERE, "../owncomps")
WORK = os.environ.get("WORK", "/tmp/owncomps"); RAW = os.environ["RAW"]
c = pd.read_json(f"{WORK}/clean.json"); h = pd.read_csv(RAW); h["id"] = "gt" + h.listing_id.astype(str)
d = c.merge(h[["id", "engine_cc", "body"]], on="id", how="left").set_index("id", drop=False)
test_ids = set(json.load(open(f"{OC}/strat_test_ids.json")))
pool = d[d.id.str.startswith("gt") & (d.search_tag == "harvest") & ~d.non_runner & ~d.held & (d.price >= 300)]
JUNK = r"\bdeposit\b|per month|\bp/?m\b|\bpcm\b|£\s?\d+\s?(?:pm|a month)|for parts|parts only"
def clean_train(t):  # drop finance/deposit-style and parts-only prices from TRAINING rows only
    j = t.desc.fillna("").str.lower().str.contains(JUNK, regex=True) & (t.price < 2500); return t[~j]
P = dict(objective="regression", learning_rate=0.04, num_leaves=31, min_data_in_leaf=20, feature_fraction=0.8, bagging_fraction=0.8,
         bagging_freq=1, lambda_l2=1.0, verbose=-1, seed=1, num_threads=8)
ROUNDS = int(os.environ.get("ROUNDS", 900))
def fit(train, extra_params=None, rounds=ROUNDS):
    f = base_frame(train); y = np.log(train.price.values)
    X = pd.concat([f[NUM], oof_te(f, y)], axis=1).astype(float)
    te = TargetEnc().fit(f, y)
    m = lgb.train({**P, **(extra_params or {})}, lgb.Dataset(X, y, free_raw_data=False), rounds)
    return m, te
def predict(m, te, t):
    f = base_frame(t); X = pd.concat([f[NUM], te.transform(f)], axis=1).astype(float); return np.exp(m.predict(X))
def stats(e):
    e = np.sort(np.asarray(e)); 
    if not len(e): return {"n": 0}
    return {"n": int(len(e)), "median": round(float(np.median(e)), 1), "p75": round(float(np.percentile(e, 75)), 1), "mean": round(float(e.mean()), 1),
            "within15": int(round((e <= 15).mean() * 100)), "within25": int(round((e <= 25).mean() * 100))}
BN = ["<2k", "2-5k", "5-10k", "10-20k", "20-40k", "40k+"]; band = lambda p: BN[int(np.searchsorted([2000, 5000, 10000, 20000, 40000], p, side="right"))]
TOP = ["ford", "volkswagen", "bmw", "audi", "peugeot", "mercedes-benz", "nissan", "vauxhall", "toyota", "land rover", "renault", "kia", "honda", "volvo", "porsche", "mg", "smart", "abarth"]
def report(r):
    out = {"overall": stats(r.err), "bias": round(float(np.median(r.signed)), 1)}
    for name, key in [("byBand", r.price.map(band)), ("bySeller", r.seller), ("byBandSeller", r.price.map(band) + "|" + r.seller), ("byMake", r.make.str.lower().map(lambda m: m if m in TOP else "other"))]:
        out[name] = {k: {**stats(g.err), "bias": round(float(np.median(g.signed)), 1)} for k, g in r.groupby(key)}
    return out
tr, ts = clean_train(pool[~pool.id.isin(test_ids)]), pool[pool.id.isin(test_ids)]
print("train", len(tr), "test", len(ts), file=sys.stderr)
m, te = fit(tr)
r = ts[["id", "make", "price", "seller"]].copy(); r["pred"] = predict(m, te, ts)
r["err"] = (r.pred - r.price).abs() / r.price * 100; r["signed"] = (r.pred - r.price) / r.price * 100
# blend with own-comps (geometric 0.7/0.3) + paired bootstrap vs own-comps
ocp = pd.DataFrame(json.load(open(os.environ["OC_PREDS"]))).set_index("id").pred if os.environ.get("OC_PREDS") else None
if ocp is not None:
    r["oc"] = ocp.reindex(r.id).values; r["blend"] = r.pred ** 0.7 * r.oc ** 0.3
    rb = r.copy(); rb["pred"] = rb.blend; rb["err"] = (rb.pred - rb.price).abs() / rb.price * 100; rb["signed"] = (rb.pred - rb.price) / rb.price * 100
    e0 = ((r.oc - r.price).abs() / r.price).values; e1 = (r.err / 100).values; rng = np.random.RandomState(0)
    bs = [np.median(e0[i]) - np.median(e1[i]) for i in (rng.randint(0, len(r), len(r)) for _ in range(1000))]
# conformal range: OOF log-residual quantiles on TRAIN, by (pred band x seller) -> tiny table, no extra models
k = np.random.RandomState(7).randint(0, 5, len(tr)); oof = np.zeros(len(tr))
for i in range(5):
    mi, tei = fit(tr[k != i]); oof[k == i] = predict(mi, tei, tr[k == i])
res = pd.DataFrame({"g": [band(p) + "|" + s for p, s in zip(oof, tr.seller)], "lr": np.log(tr.price.values / oof)})
RANGE = {g: [round(float(np.quantile(x.lr, 0.1)), 4), round(float(np.quantile(x.lr, 0.9)), 4), int(len(x))] for g, x in res.groupby("g")}
RANGE["*"] = [round(float(np.quantile(res.lr, 0.1)), 4), round(float(np.quantile(res.lr, 0.9)), 4), int(len(res))]
qq = [RANGE.get(band(p) + "|" + s, RANGE["*"]) for p, s in zip(r.pred, r.seller)]
r["lo"] = r.pred * np.exp([q[0] for q in qq]); r["hi"] = r.pred * np.exp([q[1] for q in qq])
cov = float(((r.price >= r.lo) & (r.price <= r.hi)).mean() * 100)
out = {"model": "pm-1 lightgbm l2 log-price", "train": len(tr), "test": len(ts), "strat": report(r),
       "range": {"method": "conformal OOF log-residual q10/q90 by predBand|seller", "nominal": 80, "coverage_pct": round(cov, 1),
                 "median_width_pct": round(float(np.median((r.hi - r.lo) / r.pred * 100)), 1),
                 "coverage_bySeller": {s: round(float(((g.price >= g.lo) & (g.price <= g.hi)).mean() * 100), 1) for s, g in r.groupby("seller")}}}
if ocp is not None:
    out["blend_pm70_oc30"] = report(rb); out["vsOwnComps"] = {"pm_closer_share": round(float((e1 < e0).mean()), 3),
        "median_gain_pts_CI95": [round(float(x) * 100, 2) for x in np.percentile(bs, [2.5, 50, 97.5])]}
# 32 AI-estimate cases: refit excluding them (and the fixed held set)
base = [b for b in json.load(open(f"{OC}/results_baseline.json")) if b.get("src") == "ai_estimate" and b.get("pred")]
bid = {b["id"]: b for b in base}
allp = clean_train(d[~d.held & ~d.non_runner & ~d.id.isin(bid) & (d.price >= 300)])
m2, te2 = fit(allp); a = d.loc[[i for i in bid if i in d.index]].copy(); a["pm"] = predict(m2, te2, a)
a["ai"] = [bid[i]["pred"] for i in a.id]; a["price_b"] = [bid[i]["price"] for i in a.id]
out["aiCases"] = {"n": len(a), "pm": stats((a.pm - a.price_b).abs() / a.price_b * 100)}
a[["id", "price_b", "ai", "pm", "seller"]].to_csv(f"{WORK}/pm_ai_cases.csv", index=False)
r.to_csv(f"{WORK}/pm_preds.csv", index=False)
imp = dict(zip(m.feature_name(), m.feature_importance("gain").round(0).tolist())); out["importance"] = dict(sorted(imp.items(), key=lambda x: -x[1]))
json.dump(out, open(f"{WORK}/pm_eval.json", "w"), indent=1)
if os.environ.get("EXPORT"):
    # production model: fit on ALL clean pool rows (incl. test) for deployment
    mp, tep = fit(clean_train(d[~d.held & (d.price >= 300)]))
    from export import compact, write_ts
    full = clean_train(d[~d.held & (d.price >= 300)])
    write_ts(compact(mp, tep, RANGE), os.environ.get("TS_OUT", f"{WORK}/priceModelData.ts"))
    # parity fixtures: 200 test rows -> python prediction (TS unit test must match)
    fx = ts.sample(200, random_state=3); pf = predict(mp, tep, fx)
    cols = ["make", "model", "variant", "year", "mileage", "fuel", "gearbox", "body", "engine_cc", "seller", "desc"]
    json.dump([{**{c: (None if pd.isna(v) else (v.item() if hasattr(v, "item") else v)) for c, v in zip(cols, row)}, "py": round(float(p), 2)}
               for row, p in zip(fx[cols].itertuples(index=False), pf)], open(f"{WORK}/pm_parity.json", "w"))
print(json.dumps({k: out[k] for k in ("train", "test", "range", "aiCases")}), json.dumps(out["strat"]["overall"]))
