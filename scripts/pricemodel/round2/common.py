"""Shared setup for accuracy round 2 experiments (2026-10-24). Run from this dir: WORK=<strat work dir> RAW=<harvest csv.gz> python <script>.py
Order: bodyfill.py (writes body_mode.json) -> effects.py, exp2.py, boot.py, ens.py; ens_ai.py also needs AI_OC. Outputs go to the cwd."""
import os, sys, json, numpy as np, pandas as pd, lightgbm as lgb
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import features as F
from features import base_frame, TargetEnc, oof_te, NUM, TE
HERE = os.path.dirname(os.path.abspath(__file__)); OC = os.path.join(HERE, "..", "..", "owncomps")
WORK = os.environ["WORK"]; RAW = os.environ["RAW"]  # same inputs as train.py
c = pd.read_json(f"{WORK}/clean.json"); h = pd.read_csv(RAW); h["id"] = "gt" + h.listing_id.astype(str)
d = c.merge(h[["id", "engine_cc", "body", "location"]], on="id", how="left").set_index("id", drop=False)
test_ids = set(json.load(open(f"{OC}/strat_test_ids.json")))
pool = d[d.id.str.startswith("gt") & (d.search_tag == "harvest") & ~d.non_runner & ~d.held & (d.price >= 300)]
JUNK = r"\bdeposit\b|per month|\bp/?m\b|\bpcm\b|£\s?\d+\s?(?:pm|a month)|for parts|parts only"
def clean_train(t):
    j = t.desc.fillna("").str.lower().str.contains(JUNK, regex=True) & (t.price < 2500); return t[~j]
P = dict(objective="regression", learning_rate=0.04, num_leaves=31, min_data_in_leaf=20, feature_fraction=0.8, bagging_fraction=0.8,
         bagging_freq=1, lambda_l2=1.0, verbose=-1, seed=1, num_threads=8)
tr, ts = clean_train(pool[~pool.id.isin(test_ids)]), pool[pool.id.isin(test_ids)]
BN = ["<2k", "2-5k", "5-10k", "10-20k", "20-40k", "40k+"]; band = lambda p: BN[int(np.searchsorted([2000, 5000, 10000, 20000, 40000], p, side="right"))]
def fit(train, frame=base_frame, num=NUM, rounds=900, extra=None):
    f = frame(train); y = np.log(train.price.values)
    X = pd.concat([f[num], oof_te(f, y)], axis=1).astype(float); te = TargetEnc().fit(f, y)
    return lgb.train({**P, **(extra or {})}, lgb.Dataset(X, y), rounds), te
def predict(m, te, t, frame=base_frame, num=NUM):
    f = frame(t); X = pd.concat([f[num], te.transform(f)], axis=1).astype(float); return np.exp(m.predict(X))
def strat(price, pred, seller):
    e = np.abs(pred - price) / price * 100; r = pd.DataFrame({"e": e, "b": [band(p) for p in price], "s": seller})
    o = {"overall": round(float(np.median(e)), 2)}
    for k, g in r.groupby("b"): o["band:" + k] = round(float(np.median(g.e)), 2)
    for k, g in r.groupby("s"): o["seller:" + k] = round(float(np.median(g.e)), 2)
    for k, g in r.groupby(r.b + "|" + r.s):
        if len(g) >= 50: o["bs:" + k] = round(float(np.median(g.e)), 2)
    return o
