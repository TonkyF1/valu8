"""pm-1.1 data prep: new harvest rows since the pm-1 snapshot (2026-10-24), cleaned by the SAME owncomps pipeline
(build_listings.py + clean.py on snapshot rows + new rows), then: drop new rows that are relists/duplicates of a held-out
advert (same make|model|year and mileage within 100mi, or same make|model|year + same first 80 chars of advert text), and of any old
train row (same make|model|year, mileage within 10mi, price within 20%: a relist). Wider mileage windows were tested and the match
count grew linearly with the window (random collisions on common cars), so only near-exact matches are treated as the same advert.
Writes new_pool.json and dup report."""
import pandas as pd, json, numpy as np, sys
OLD = sys.argv[1]; NEW = sys.argv[2]; NEWRAW = sys.argv[3]; TEST = sys.argv[4]
o = pd.read_json(OLD); c = pd.read_json(NEW)
new_raw = set("gt" + pd.read_csv(NEWRAW, dtype=str).listing_id)
test = set(json.load(open(TEST)))
n = c[c.id.isin(new_raw) & ~c.id.isin(set(o.id))]
pool = n[n.id.str.startswith("gt") & (n.search_tag == "harvest") & ~n.non_runner & ~n.held & (n.price >= 300)].copy()
key = lambda t: t.make.str.lower() + "|" + t.model.str.lower() + "|" + t.year.astype(str)
def dupmask(p, ref, tol, ptol=None, desc=False):
    r = ref.assign(k=key(ref)); g = {k: (x.mileage.values, x.price.values) for k, x in r.groupby("k")}
    out = []
    for k, mi, pr in zip(key(p), p.mileage, p.price):
        a = g.get(k); hit = False
        if a is not None:
            ok = np.abs(a[0] - mi) <= tol
            if ptol is not None: ok &= np.abs(a[1] / pr - 1) <= ptol
            hit = bool(ok.any())
        out.append(hit)
    out = np.array(out)
    if desc:
        dk = lambda t: key(t) + "|" + t.desc.fillna("").str.slice(0, 80).str.lower()
        rd = set(dk(ref)[ref.desc.fillna("").str.len() > 40]); out |= dk(p).isin(rd).values & (p.desc.fillna("").str.len() > 40).values
    return out
ts = o[o.id.isin(test)]; oldpool = o[o.id.str.startswith("gt") & (o.search_tag == "harvest") & ~o.non_runner & ~o.held & (o.price >= 300)]
dt = dupmask(pool, ts, 100, desc=True); do = dupmask(pool, oldpool[~oldpool.id.isin(test)], 10, 0.2)
rep = {"new_raw": len(new_raw), "new_after_clean": int(len(n)), "new_pool": int(len(pool)), "dup_of_heldout": int(dt.sum()), "dup_of_old_train": int((do & ~dt).sum())}
pool = pool[~dt & ~do]; rep["new_usable"] = int(len(pool)); rep["seller"] = pool.seller.value_counts().to_dict()
pool.to_json("new_pool.json", orient="records"); print(json.dumps(rep)); json.dump(rep, open("new_rows_report.json", "w"), indent=1)
