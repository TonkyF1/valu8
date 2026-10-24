"""Feature builder for the Valu8 trained price model (pm-1). Mirrors supabase/functions/_shared/priceModel.ts featurize()."""
import re, numpy as np, pandas as pd
REF_YEAR = 2026
FUELS = ["petrol", "diesel", "hybrid", "electric", "other"]
GEARS = ["manual", "automatic"]
BODIES = ["hatchback", "estate", "saloon", "mpv", "suv", "coupe", "convertible", "pick up", "van", "other"]
def norm_fuel(f):
    f = str(f or "").lower()
    if "hybrid" in f: return "hybrid"
    if "electric" in f: return "electric"
    if "diesel" in f: return "diesel"
    if "petrol" in f or f == "": return "petrol"
    return "other"
def norm_body(b):
    b = str(b or "").lower()
    if "van" in b: return "van"
    if "4x4" in b or "suv" in b: return "suv"
    if "pick" in b: return "pick up"
    return b if b in BODIES else "other"
PERF = r"\b(?:st(?:-?[23])?|rs\d?|gti|gtd|r32|type ?r|amg|m[2-8]\b|m ?performance|vrs|cupra|n performance|gr|svr|sv|quadrifoglio|abarth|nismo|s[3-8]|rs[3-7]|john cooper works|jcw|renaultsport|gsi|vxr|opc|sti|evo|wrx)\b"
TEXT = {  # name: regex over variant + ad text (lower-case)
    "t_spares": r"spares (?:or|and|/) repair|non[- ]?runner|not running|won.t start|breaking|needs (?:a )?(?:new )?(?:clutch|engine|gearbox|turbo)|engine (?:fault|problem|issue)|gearbox (?:fault|problem|issue)",
    "t_cat": r"\bcat(?:egory)?[\s.:-]+[snbcd]\b|write[- ]?off|written[- ]off",
    "t_nomot": r"no mot|mot expired|without mot|mot ran out",
    "t_longmot": r"(?:12|11|10|full|fresh|new|long) ?(?:months?)? ?mot|mot (?:until|till|to|expires?) (?:\w+ )?202[7-9]",
    "t_fsh": r"\bfsh\b|full (?:service|dealer) history|fdsh",
    "t_ulez": r"ulez",
    "t_lowmiles": r"low (?:miles|mileage)",
    "t_warranty": r"warranty",
    "t_finance": r"finance|part ex|px welcome",
    "t_urgent": r"urgent|quick sale|need gone|cheap|bargain",
    "t_damage": r"damage|dent|scratch|rust|needs work|project|repair",
    "t_oneowner": r"one owner|1 owner",
}
def norm_trim(v):
    v = re.sub(r"[^a-z0-9 ]", " ", str(v or "").lower()); return re.sub(r"\s+", " ", v).strip()
def base_frame(d):
    """d needs: make, model, variant, year, mileage, fuel, gearbox, body, engine_cc, seller, desc."""
    o = pd.DataFrame(index=d.index)
    o["make"] = d.make.astype(str).str.lower(); o["model"] = o.make + "|" + d.model.astype(str).str.lower()
    o["trim"] = o.model + "|" + d.variant.map(norm_trim)
    o["age"] = (REF_YEAR - d.year).clip(0, 45).astype(float)
    mi = d.mileage.astype(float).clip(0, 400000)
    o["lmiles"] = np.log1p(mi / 1000); o["mpy"] = mi / np.maximum(o.age, 0.5) / 1000
    o["cc"] = pd.to_numeric(d.get("engine_cc"), errors="coerce").where(lambda x: (x > 500) & (x < 8000))
    o["fuel"] = d.fuel.map(norm_fuel).map(FUELS.index).astype(float)
    o["gear"] = d.gearbox.astype(str).str.lower().map(lambda g: 1.0 if g.startswith("auto") else 0.0)
    o["body"] = d.get("body", pd.Series("", index=d.index)).map(norm_body).map(BODIES.index).astype(float)
    o["dealer"] = (d.seller == "dealer").astype(float)
    txt = (d.variant.fillna("").astype(str) + " " + d.desc.fillna("").astype(str)).str.lower()
    o["perf"] = (d.model.astype(str).str.lower() + " " + d.variant.fillna("").astype(str).str.lower()).str.contains(PERF, regex=True).astype(float)
    for k, rx in TEXT.items(): o[k] = txt.str.contains(rx, regex=True).astype(float)
    return o
class TargetEnc:
    """Hierarchical smoothed target encoding: make -> model -> trim, each shrunk to its parent (pseudo-count K)."""
    def __init__(self, K=(20, 8, 5)): self.K = K
    def fit(self, f, y):
        self.g = float(np.mean(y)); self.tab = {}
        df = pd.DataFrame({"make": f.make.values, "model": f.model.values, "trim": f.trim.values, "y": np.asarray(y)})
        for lvl, K, parent in [("make", self.K[0], None), ("model", self.K[1], "make"), ("trim", self.K[2], "model")]:
            s = df.groupby(lvl).y.agg(["sum", "count"]); t = {}
            for key, (sm, n) in s.iterrows():
                p = self.g if parent is None else self.tab[parent].get(key.rsplit("|", 1)[0] if lvl != "model" else key.split("|")[0], (self.g, 0))[0]
                t[key] = ((sm + K * p) / (n + K), int(n))
            self.tab[lvl] = t
        return self
    def transform(self, f):
        o = pd.DataFrame(index=f.index)
        mk = [self.tab["make"].get(k, (self.g, 0)) for k in f.make]
        md = [self.tab["model"].get(k, (m[0], 0)) for k, m in zip(f.model, mk)]
        tr = [self.tab["trim"].get(k, (m[0], 0)) for k, m in zip(f.trim, md)]
        o["te_make"] = [x[0] for x in mk]; o["te_model"] = [x[0] for x in md]; o["te_trim"] = [x[0] for x in tr]
        o["n_model"] = np.log1p([x[1] for x in md]); o["n_trim"] = np.log1p([x[1] for x in tr])
        return o
NUM = ["age", "lmiles", "mpy", "cc", "fuel", "gear", "body", "dealer", "perf"] + list(TEXT)
TE = ["te_make", "te_model", "te_trim", "n_model", "n_trim"]
def oof_te(f, y, folds=5, seed=0):
    """Out-of-fold target encoding for the training rows (prevents leakage)."""
    rng = np.random.RandomState(seed); k = rng.randint(0, folds, len(f)); out = pd.DataFrame(index=f.index, columns=TE, dtype=float)
    for i in range(folds):
        te = TargetEnc().fit(f[k != i], np.asarray(y)[k != i]); out.loc[f.index[k == i]] = te.transform(f[k == i]).values
    return out
