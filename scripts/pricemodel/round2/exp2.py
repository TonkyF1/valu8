from common import *
from feats2 import frame2, NUM2, NEW
import features as Fm
def loc_frame(d):
    o = frame2(d); return o
def run(name, frame, num, seeds=(1, 2, 3), test=ts, mod=None, extra=None):
    ps = []
    for s in seeds:
        m, te = fit(tr, frame, num, extra={**(extra or {}), "seed": s}); t = test if mod is None else mod(test.copy())
        ps.append(predict(m, te, t, frame, num))
    p = np.exp(np.mean(np.log(ps), 0)); st = strat(test.price.values, p, test.seller.values); print(name, json.dumps(st)); return p, st
R = {}
p1, R["pm1"] = run("pm1", base_frame, NUM)
def nocc(t): t["engine_cc"] = np.nan; t["body"] = ""; return t
_, R["pm1_no_cc_body_at_test"] = run("pm1 test-without-cc/body", base_frame, NUM, mod=nocc)
p2, R["pm2_text"] = run("pm2 text+owners", frame2, NUM2)
# region from ad town (target-encoded town): diagnostic only (production would need reg area code -> region)
def frame_loc(d):
    o = frame2(d); o["loc"] = d.location.fillna("").str.lower(); return o
tl = tr.copy(); y = np.log(tl.price.values)
# residual town effect: OOF residual of pm2 by town, shrunk k=30
k = np.random.RandomState(5).randint(0, 5, len(tl)); oof = np.zeros(len(tl))
for i in range(5):
    m, te = fit(tl[k != i], frame2, NUM2, 500); oof[k == i] = predict(m, te, tl[k == i], frame2, NUM2)
res = pd.DataFrame({"loc": tl.location.fillna("").str.lower().values, "r": np.log(tl.price.values / oof)})
g = res.groupby("loc").r.agg(["sum", "count"]); town = (g["sum"] / (g["count"] + 30)).to_dict()
adj = np.exp(ts.location.fillna("").str.lower().map(town).fillna(0).values)
R["pm2_plus_town"] = strat(ts.price.values, p2 * adj, ts.seller.values); print("pm2+town", json.dumps(R["pm2_plus_town"]))
print("town effect spread p10/p90 %", np.percentile([(np.exp(v)-1)*100 for v in town.values()], [10, 90]))
json.dump(R, open("exp2.json", "w"), indent=1)
pd.DataFrame({"id": ts.id.values, "price": ts.price.values, "seller": ts.seller.values, "pm1": p1, "pm2": p2}).to_csv("test_preds.csv", index=False)
