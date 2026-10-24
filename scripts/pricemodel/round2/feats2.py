import re, numpy as np, pandas as pd
from features import base_frame, NUM
NEW = {
 "t_motfail": r"fail(?:ed)? (?:its |the |it'?s |an? )?mot|mot fail",
 "t_advis": r"advisor(?:y|ies)",
 "t_noadv": r"no advisor|advisory[- ]free|zero advisor|clean mot|passed (?:its |the )?mot with no",
 "t_rust": r"\brust|corros",
 "t_newparts": r"new (?:clutch|cambelt|timing belt|brakes|tyres|tires|discs|battery|exhaust)|(?:cambelt|timing (?:belt|chain)) (?:done|changed|replaced)",
 "t_hpi": r"hpi clear|clear hpi",
 "t_warn": r"warning light|engine light|\beml\b|limp mode|dpf",
 "t_svc": r"service history|serviced|service book",
 "t_smoke": r"smok|knock|rattl|oil leak|leaks? oil|misfir|overheat",
}
def owners(txt):
    m = txt.str.extract(r"(\d{1,2}) (?:previous |prev |former )?(?:keepers?|owners?)", expand=False)
    return pd.to_numeric(m, errors="coerce").where(lambda x: x < 20)
def frame2(d):
    o = base_frame(d); txt = (d.variant.fillna("").astype(str) + " " + d.desc.fillna("").astype(str)).str.lower()
    for k, rx in NEW.items(): o[k] = txt.str.contains(rx, regex=True).astype(float)
    o["owners"] = owners(txt); o["desclen"] = np.log1p(d.desc.fillna("").str.len())
    return o
NUM2 = NUM + list(NEW) + ["owners"]
