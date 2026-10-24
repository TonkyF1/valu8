import pandas as pd, numpy as np
t = pd.read_csv("test_preds.csv"); e1 = np.abs(t.pm1 / t.price - 1); e2 = np.abs(t.pm2 / t.price - 1); r = np.random.RandomState(0)
d = [np.median(e1.values[i]) - np.median(e2.values[i]) for i in [r.randint(0, len(t), len(t)) for _ in range(1000)]]
print("gain pts", round((np.median(e1) - np.median(e2)) * 100, 2), "90%CI", np.round(np.percentile(d, [5, 95]) * 100, 2), "P(gain>0)", np.mean(np.array(d) > 0))
