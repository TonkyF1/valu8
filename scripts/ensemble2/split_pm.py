# Splits (A = original stratified held-out ids, B = fresh time holdout) + honest pm-1-algorithm predictions (trained on TRAIN only).
import os, sys, json, numpy as np, pandas as pd, lightgbm as lgb
sys.path.insert(0, "/workspace/valu8-d/scripts/pricemodel")
from features import base_frame, TargetEnc, oof_te, NUM, norm_body
W = os.environ["WORK"]
c = pd.read_json(f"{W}/clean.json"); h = pd.read_csv(f"{W}/harvest_snapshot.csv.gz"); h["id"] = "gt" + h.listing_id.astype(str)
d = c.merge(h[["id", "engine_cc", "body", "first_seen"]], on="id", how="left").set_index("id", drop=False)
pool = d[d.id.str.startswith("gt") & (d.search_tag == "harvest") & ~d.non_runner & ~d.held & (d.price >= 300)].copy()
A = set(json.load(open("/workspace/valu8-d/scripts/owncomps/strat_test_ids.json"))) & set(pool.id)
BN = ["<2k", "2-5k", "5-10k", "10-20k", "20-40k", "40k+"]; band = lambda p: BN[int(np.searchsorted([2000, 5000, 10000, 20000, 40000], p, side="right"))]
new = pool[(pool.first_seen >= "2026-10-24") & ~pool.id.isin(A)].copy(); new["num"] = new.id.str[2:].astype(int)
new["st"] = new.price.map(band) + "|" + new.seller
B = set(); 
for _, g in new.groupby("st"): B |= set(g.sort_values("num").tail(max(1, int(round(len(g) * 0.2)))).id)
hold = pool[pool.id.isin(A | B)]
# relist guard: drop train rows that look like the same car as a held-out row
key = lambda t: t.make + "|" + t.model + "|" + t.year.astype(str)
hk = {}; [hk.setdefault(k, []).append(m) for k, m in zip(key(hold), hold.mileage)]
rest = pool[~pool.id.isin(A | B)]
rel = np.array([any(abs(m - x) <= 100 for x in hk.get(k, [])) for k, m in zip(key(rest), rest.mileage)])
JUNK = r"\bdeposit\b|per month|\bp/?m\b|\bpcm\b|£\s?\d+\s?(?:pm|a month)|for parts|parts only"
train = rest[~rel]; train = train[~(train.desc.fillna("").str.lower().str.contains(JUNK, regex=True) & (train.price < 2500))]
print("pool", len(pool), "A", len(A), "B", len(B), "relist-dropped", int(rel.sum()), "train", len(train), file=sys.stderr)
json.dump({"A": sorted(A), "B": sorted(B), "train": sorted(train.id)}, open(f"{W}/splits.json", "w"))
P = dict(objective="regression", learning_rate=0.04, num_leaves=31, min_data_in_leaf=20, feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1, seed=1, num_threads=8)
f = base_frame(train); y = np.log(train.price.values)
X = pd.concat([f[NUM], oof_te(f, y)], axis=1).astype(float); te = TargetEnc().fit(f, y)
m = lgb.train(P, lgb.Dataset(X, y), 900)
mk = train.make.str.lower() + "|" + train.model.str.lower()
mode = train.assign(b=train.body.map(norm_body), k=mk).query("b not in ['suv','other']").groupby("k").b.agg(lambda s: s.value_counts().index[0])
ts = hold.copy(); kk = ts.make.str.lower() + "|" + ts.model.str.lower(); nb = ts.body.map(norm_body)
ts["body"] = np.where(nb.isin(["suv", "other"]) | ts.body.isna(), kk.map(mode).fillna(""), ts.body)
def pred(t):
    ff = base_frame(t); XX = pd.concat([ff[NUM], te.transform(ff)], axis=1).astype(float); return np.exp(m.predict(XX)), te.transform(ff)
pp, tt = pred(ts.assign(seller="private", desc="")); pdl, _ = pred(ts.assign(seller="dealer", desc=""))  # desc empty: prod passes no advert text
out = pd.DataFrame({"id": ts.id, "split": np.where(ts.id.isin(A), "A", "B"), "price": ts.price, "seller": ts.seller, "pm_priv": pp, "pm_dealer": pdl,
                    "n_model": np.expm1(tt.n_model.values).round(), "n_trim": np.expm1(tt.n_trim.values).round()})
out.to_csv(f"{W}/pm_hold.csv", index=False)
e = np.abs(np.where(out.seller == "dealer", out.pm_dealer, out.pm_priv) - out.price) / out.price * 100
for s in ["A", "B"]: print(s, "pm median", round(float(np.median(e[out.split == s])), 2), file=sys.stderr)
