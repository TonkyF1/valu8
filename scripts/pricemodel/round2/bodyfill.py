from common import *
from features import norm_body
import features as Fm
m, te = fit(tr)
key = lambda t: t.make.str.lower() + "|" + t.model.str.lower()
mode = tr.assign(k=key(tr), b=tr.body.map(norm_body)).groupby("k").b.agg(lambda s: s.value_counts().index[0])
fill = ts.copy(); fill["body"] = key(ts).map(mode).fillna("")
print("mode coverage", (fill.body != "").mean(), "agree", (fill.body == ts.body.map(norm_body)).mean())
for nm, t in [("true", ts), ("none(prod now)", ts.assign(body="")), ("model-mode fill", fill)]:
    print(nm, json.dumps(strat(ts.price.values, predict(m, te, t), ts.seller.values)))
json.dump({k: v for k, v in mode.items()}, open(os.path.join(HERE, "body_mode.json"), "w"))
