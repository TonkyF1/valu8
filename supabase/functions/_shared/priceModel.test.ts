import { assert, assertEquals } from "jsr:@std/assert@1";
import { pricePm, pricePmBoth, featurize, score, blendWithOwnComps } from "./priceModel.ts";
import { PM_MODEL } from "./priceModelData.ts";
import fixtures from "./priceModel.parity.json" with { type: "json" };

Deno.test("parity with Python LightGBM on 200 held-out listings (<0.5%)", () => {
  let worst = 0;
  for (const fx of fixtures) {
    const p = Math.exp(score(featurize(fx).vec)); const d = Math.abs(p - fx.py) / fx.py;
    worst = Math.max(worst, d);
  }
  assert(worst < 0.005, `worst parity diff ${(worst * 100).toFixed(3)}%`);
});
Deno.test("feature vector matches model feature list", () => {
  const f = featurize({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 70000 });
  assertEquals(f.vec.length, PM_MODEL.features.length); assert(f.vec.every((v, i) => PM_MODEL.features[i] === "cc" || Number.isFinite(v)));
});
Deno.test("sane, monotone-ish prices and ordered range", () => {
  const a = pricePm({ make: "Volkswagen", model: "Golf", variant: "SE", year: 2018, mileage: 40000, seller: "private" });
  const b = pricePm({ make: "Volkswagen", model: "Golf", variant: "SE", year: 2012, mileage: 120000, seller: "private" });
  assert(a.price > b.price, `${a.price} vs ${b.price}`); assert(a.low <= a.price && a.price <= a.high);
  assert(a.price > 4000 && a.price < 20000, String(a.price));
  const both = pricePmBoth({ make: "Ford", model: "Fiesta", variant: "Zetec", year: 2016, mileage: 70000 });
  assert(both.dealer.price >= both.private.price * 0.95, JSON.stringify(both));
});
Deno.test("spares/repair text pulls the price down; unknown make still prices", () => {
  const base = { make: "Ford", model: "Focus", variant: "Titanium", year: 2015, mileage: 90000, seller: "private" as const };
  const ok = pricePm(base), bad = pricePm({ ...base, desc: "Spares or repair, gearbox fault" });
  assert(bad.price < ok.price, `${bad.price} vs ${ok.price}`);
  const u = pricePm({ make: "Zzz", model: "Nothing", year: 2015, mileage: 80000 }); assertEquals(u.known, "none"); assert(u.price > 0);
});
Deno.test("blend helper", () => { assertEquals(blendWithOwnComps(5000, null), 5000); assert(blendWithOwnComps(5000, 4000) < 5000); });
