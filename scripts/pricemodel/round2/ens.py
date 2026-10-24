# Tune segment weights for the pm-1 / own-comps (/AI) ensemble on the stratified held-out set; honest eval via repeated 2-fold cross-fitting.
from common import *
import features as Fm
from features import norm_body
mode = json.load(open(os.path.join(HERE, "body_mode.json")))
m, te = fit(tr)
key = ts.make.str.lower() + "|" + ts.model.str.lower()
pm_true = predict(m, te, ts); pm_fill = predict(m, te, ts.assign(body=key.map(mode).fillna("")))
pm_dealer = predict(m, te, ts.assign(body=key.map(mode).fillna(""), seller="dealer")); pm_priv = predict(m, te, ts.assign(body=key.map(mode).fillna(""), seller="private"))
f = base_frame(ts); te_cnt = te.transform(f)
known_model = (te_cnt["n_model"] > 0).values
oc = pd.DataFrame(json.load(open(f"{WORK}/strat_preds.json"))).set_index("id").reindex(ts.id)
txt = (ts.variant.fillna("") + " " + ts.desc.fillna("")).str.lower()
hastext = np.zeros(len(ts), bool)
for rx in Fm.TEXT.values(): hastext |= txt.str.contains(rx, regex=True).values
D = pd.DataFrame({"id": ts.id.values, "price": ts.price.values, "seller": ts.seller.values, "pm": pm_fill, "pm_true": pm_true, "oc": oc.pred.values,
                  "oc_level": oc.level.values, "oc_n": oc.n.values, "oc_conf": oc.conf.values, "pm_known_model": known_model, "hastext": hastext})
D = D[D.oc.notna() & (D.oc > 0)].reset_index(drop=True); print("rows", len(D))
D.to_csv("ens_test.csv", index=False)
BAND = lambda p: np.where(p < 2000, "<2k", np.where(p < 5000, "2-5k", np.where(p < 10000, "5-10k", "10k+")))
D["seg"] = (BAND(D.pm) + "|" + D.seller + "|" + np.where(D.pm_known_model, "pmK", "pmU") + "|" + np.where((D.oc_level == "model") & (D.oc_conf >= 0.6), "ocC", "ocW")
            + "|" + np.where(D.hastext, "txt", "notxt"))
lpm, loc_, lp = np.log(D.pm.values), np.log(D.oc.values), np.log(D.price.values)
W = np.round(np.arange(0, 1.0001, 0.05), 2)
def best_w(idx):
    e = [np.median(np.abs(np.exp(w * lpm[idx] + (1 - w) * loc_[idx] - lp[idx]) - 1)) for w in W]; return W[int(np.argmin(e))]
K = 150  # shrinkage strength (rows)
LEVELS = [lambda s: s.str.split("|").str[:2].str.join("|"), lambda s: s.str.split("|").str[:4].str.join("|"), lambda s: s]
def fit_w(idx):
    g = best_w(idx); table = {"*": g}; prior = pd.Series(g, index=D.index[idx])
    for L in LEVELS:  # hierarchical shrinkage: band|seller -> +known/conf -> +text
        s = L(D.seg.iloc[idx]); new = prior.copy()
        for k, ii in s.groupby(s).groups.items():
            ii = np.array([D.index.get_loc(i) for i in ii]); n = len(ii); w = best_w(ii); p0 = prior.loc[D.index[ii]].iloc[0]
            v = round((n * w + K * p0) / (n + K), 3); table[k] = v; new.loc[D.index[ii]] = v
        prior = new
    return table
def lookup(table, seg):
    p = seg.split("|")
    for k in ["|".join(p), "|".join(p[:4]), "|".join(p[:2])]:
        if k in table: return table[k]
    return table["*"]
def err(pred, idx): return np.abs(pred / D.price.values[idx] - 1)
rng = np.random.RandomState(7); E = {"pm": [], "oc": [], "blend07": [], "ens": []}; segE = []
for rep in range(10):
    fold = rng.randint(0, 2, len(D))
    for k in (0, 1):
        tri, tei = np.where(fold != k)[0], np.where(fold == k)[0]; T = fit_w(tri)
        w = np.array([lookup(T, s) for s in D.seg.values[tei]])
        ens = np.exp(w * lpm[tei] + (1 - w) * loc_[tei]); b = np.exp(0.7 * lpm[tei] + 0.3 * loc_[tei])
        segE.append(pd.DataFrame({"i": tei, "pm": err(D.pm.values[tei], tei), "oc": err(D.oc.values[tei], tei), "blend07": err(b, tei), "ens": err(ens, tei)}))
S = pd.concat(segE); S = S.groupby("i").mean()  # average error per row across reps
S["price"] = D.price.values[S.index]; S["seller"] = D.seller.values[S.index]
res = {}
for c in ["pm", "oc", "blend07", "ens"]: res[c] = strat(S.price.values, S.price.values * (1 + S[c].values), S.seller.values)
for c, v in res.items(): print(c, json.dumps(v))
print("pm with TRUE body (eval-time reference)", strat(D.price.values, D.pm_true.values, D.seller.values)["overall"])
final = fit_w(np.arange(len(D))); json.dump(final, open("ens_weights.json", "w"), indent=0); print("n weights", len(final), "global", final["*"])
json.dump(res, open("ens_eval.json", "w"), indent=1)
# disagreement-based range widening: coverage of the pm conformal range by |log(pm/oc)| bucket
R = json.load(open(f"{WORK}/pmModel.json"))["range"]
bn = lambda p: BN[int(np.searchsorted([2000, 5000, 10000, 20000, 40000], p, side="right"))]
q = np.array([R.get(bn(p) + "|" + s, R["*"]) if R.get(bn(p) + "|" + s, [0, 0, 0])[2] >= 30 else R["*"] for p, s in zip(D.pm, D.seller)])
w = np.array([lookup(final, s) for s in D.seg]); ens = np.exp(w * lpm + (1 - w) * loc_)
dis = np.abs(lpm - loc_); r = lp - np.log(ens)
for lo, hi in [(0, .1), (.1, .2), (.2, .3), (.3, .5), (.5, 9)]:
    s = (dis >= lo) & (dis < hi); cov = np.mean((r[s] >= q[s, 0]) & (r[s] <= q[s, 1]))
    # widening factor needed to reach 80%
    for a in np.arange(1, 3.01, 0.05):
        if np.mean((r[s] >= a * q[s, 0]) & (r[s] <= a * q[s, 1])) >= 0.8: break
    print(f"dis {lo}-{hi}: n={s.sum()} coverage={cov:.3f} widen x{a:.2f} medErr={np.median(np.abs(np.exp(r[s])-1))*100:.1f}")
