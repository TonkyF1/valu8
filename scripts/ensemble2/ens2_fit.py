# ens-2: confidence-weighted pm/own-comps blend + small bias corrections, fitted on held-out split A (honest preds), checked on B.
import json, os, numpy as np, pandas as pd
from scipy.optimize import minimize
W = os.environ["WORK"]; D = pd.read_pickle(f"{W}/D.pkl")
def X_of(D):
    age = (2026 - D.year).clip(lower=0).values.astype(float); mr = np.log(np.maximum(D.mileage.values, 1000) / (np.maximum(age, 1) * 8000))
    old = (age >= 5).astype(float); dl = D.dl.values.astype(float); perf = D.perf.values.astype(float); nn = (age <= 2).astype(float)
    lnm = np.log1p(D.n_model.values) - 4
    lpm = np.log(D.pm.values); loc = np.log(D.on.values)
    Zw = np.c_[np.ones(len(D)), D.on_conf.values - 0.6, lnm, nn, perf, dl, (D.on_level.values != "model").astype(float)]
    Zc = np.c_[np.ones(len(D)), dl, perf]  # mileage-for-age and near-new corrections tested: inconsistent sign A vs B -> dropped
    return lpm, loc, Zw, Zc
NAMES_W = ["w:" + x for x in ["w0", "oc_conf", "pm_log_n_model", "near_new", "perf", "dealer", "oc_not_model_level"]]
NAMES_C = ["c:" + x for x in ["c0", "dealer", "perf"]]
def pred(th, lpm, loc, Zw, Zc):
    nw = Zw.shape[1]; w = 1 / (1 + np.exp(-(Zw @ th[:nw]))); return w * lpm + (1 - w) * loc + Zc @ th[nw:], w
def fit(D, lam=2.0):
    lpm, loc, Zw, Zc = X_of(D); y = np.log(D.price.values)
    th0 = np.r_[np.log(0.7 / 0.3), np.zeros(Zw.shape[1] - 1), np.zeros(Zc.shape[1])]
    def loss(th):
        r = pred(th, lpm, loc, Zw, Zc)[0] - y; return np.mean(np.sqrt(r * r + 1e-4)) + lam * 1e-3 * np.sum((th[1:] - th0[1:]) ** 2)
    return minimize(loss, th0, method="L-BFGS-B").x
def err(D, p): return np.abs(np.exp(p) / D.price.values - 1) * 100
A = D[D.split == "A"].reset_index(drop=True); B = D[D.split == "B"].reset_index(drop=True)
def ens1(D): return np.log(np.exp(0.7 * np.log(D.pm.values) + 0.3 * np.log(D.on.values)))
# repeated 2-fold cross-fit on A
rs = []
for seed in range(5):
    k = np.random.RandomState(seed).randint(0, 2, len(A)); p = np.zeros(len(A))
    for f in (0, 1):
        th = fit(A[k != f]); p[k == f] = pred(th, *X_of(A[k == f]))[0]
    rs.append(np.median(err(A, p)))
th = fit(A)
pB, wB = pred(th, *X_of(B)); pA, wA = pred(th, *X_of(A))
def strat(D, e):
    o = {"all": round(float(np.median(e)), 2), "n": len(D)}
    for s in ["private", "dealer"]: o[s] = round(float(np.median(e[D.seller.values == s])), 2)
    b = (D.price >= 5000) & (D.price < 20000); o["5-20k"] = round(float(np.median(e[b.values])), 2)
    o["w10"] = round(float(np.mean(e <= 10) * 100), 1); o["w20"] = round(float(np.mean(e <= 20) * 100), 1); o["o30"] = round(float(np.mean(e > 30) * 100), 1)
    return o
res = {"A_crossfit_ens2_median_by_seed": [round(float(x), 2) for x in rs],
       "A": {"pm": strat(A, err(A, np.log(A.pm.values))), "oc_old": strat(A, err(A, np.log(A.oo.values))), "oc_new": strat(A, err(A, np.log(A.on.values))),
             "ens1_oldoc": strat(A, err(A, np.log(A.e_old.values))), "ens1_newoc": strat(A, err(A, ens1(A))), "ens2_in_sample": strat(A, err(A, pA))},
       "B": {"pm": strat(B, err(B, np.log(B.pm.values))), "oc_old": strat(B, err(B, np.log(B.oo.values))), "oc_new": strat(B, err(B, np.log(B.on.values))),
             "ens1_oldoc": strat(B, err(B, np.log(B.e_old.values))), "ens1_newoc": strat(B, err(B, ens1(B))), "ens2": strat(B, err(B, pB))},
       "theta": dict(zip(NAMES_W + NAMES_C, [round(float(x), 4) for x in th])), "w_pm_quantiles_B": [round(float(x), 2) for x in np.quantile(wB, [0.05, 0.25, 0.5, 0.75, 0.95])]}
json.dump(res, open(f"{W}/ens2_fit.json", "w"), indent=1); print(json.dumps(res, indent=1))
