// gb-1 (G6WLN, 2019 BMW X3 M40i priced at £13,200 as a manual generic X3).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { inferPerformanceTrim } from "./perfTrim.ts";
import { detectPerformanceVariant } from "./performance.ts";
import { resolveVariant, perfCompReference } from "./variantGuard.ts";
import { valueWithOwnComps } from "./ownCompsAdjust.ts";
import { pricePm } from "./priceModel.ts";

const X3 = { make: "BMW", model: "X3", year: 2019, mileage: 54000, fuel: "Petrol", currentYear: 2026 };

Deno.test("gb1: 2,998cc petrol X3 / X4 (G01/G02) is the M40i, any fuel label", () => {
  for (const [model, year, fuel] of [["X3", 2019, "Petrol"], ["X3", 2022, "Hybrid Electric"], ["X4", 2020, "Petrol"]] as const) {
    const h = inferPerformanceTrim({ make: "BMW", model, fuel, cc: 2998, year });
    assertEquals(h?.variant, "M40i", `${model} ${year}`);
    assertEquals(h?.confident, true);
  }
  const r = resolveVariant({ make: "BMW", model: "X3", fuel: "Petrol", cc: 2998, year: 2019 });
  assertEquals(r.variant, "M40i");
  assertEquals(r.displayModel, "X3 M40i");
});
Deno.test("gb1: S58 2,993cc petrol X3 / X4 from 2019 is the X3 M / X4 M; diesel 2,993cc is not", () => {
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X3", fuel: "Petrol", cc: 2993, year: 2020 })?.variant, "X3 M");
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X4", fuel: "Petrol", cc: 2993, year: 2021 })?.variant, "X4 M");
  assertEquals(resolveVariant({ make: "BMW", model: "X3", fuel: "Petrol", cc: 2993, year: 2020 }).displayModel, "X3 M");
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X3", fuel: "Diesel", cc: 2993, year: 2020 }), null);
});
Deno.test("gb1: no rule for 2.0 X3s, pre-2018 X3s or the 2024+ X3 (shares 2,998cc with the M50)", () => {
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X3", fuel: "Petrol", cc: 1998, year: 2019 }), null);
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X3", fuel: "Petrol", cc: 2998, year: 2016 }), null);
  assertEquals(inferPerformanceTrim({ make: "BMW", model: "X3", fuel: "Petrol", cc: 2998, year: 2025 }), null);
});
Deno.test("gb1: BMW perf pattern now matches M40i / M40d / M50d, still not M Sport", () => {
  for (const v of ["M40i", "M40d", "M50d", "xDrive M40i"]) assertEquals(detectPerformanceVariant("BMW", "X3", v, "")?.key, "bmw-m", v);
  assertEquals(detectPerformanceVariant("BMW", "X3", "M Sport", ""), null);
  assertEquals(detectPerformanceVariant("BMW", "X3", "xDrive20d M Sport", ""), null);
});
Deno.test("gb1: M40i comps must be the same base model (no Z4 M40i pooled into an X3)", () => {
  const perf = detectPerformanceVariant("BMW", "X3", "M40i", "")!;
  const rows = [
    ...Array(8).fill({ model: "Z4", variant: "M40i", year: 2019, mileage: 50000, price: 30000, seller: "private" }),
    { model: "X3", variant: "M40i", year: 2019, mileage: 50000, price: 24000, seller: "private" },
  ];
  assertEquals(perfCompReference(perf, rows, { year: 2019, mileage: 54000, token: "m40i", base: "X3" }).n, 1);
});
Deno.test("gb1: blank gearbox no longer prices an automatic-only model as a manual", () => {
  const manual = valueWithOwnComps({ ...X3, gearbox: "Manual" } as any).privatePrice;
  const auto = valueWithOwnComps({ ...X3, gearbox: "Automatic" } as any).privatePrice;
  const unknown98 = valueWithOwnComps({ ...X3, autoShare: 0.98 } as any).privatePrice;
  assert(unknown98 > manual * 1.3, `unknown ${unknown98} vs manual ${manual}`);
  assert(Math.abs(unknown98 / auto - 1) < 0.05, `unknown ${unknown98} vs auto ${auto}`);
  const pmManual = pricePm({ ...X3, engine_cc: 2998, gearbox: null }).price;
  const pmBlend = pricePm({ ...X3, engine_cc: 2998, gearbox: null, autoShare: 0.98 }).price;
  const pmAuto = pricePm({ ...X3, engine_cc: 2998, gearbox: "Automatic" }).price;
  assert(pmBlend > pmManual && pmBlend <= pmAuto, `${pmManual} < ${pmBlend} <= ${pmAuto}`);
  // A given gearbox ignores autoShare.
  assertEquals(pricePm({ ...X3, engine_cc: 2998, gearbox: "Manual", autoShare: 0.98 }).price, pricePm({ ...X3, engine_cc: 2998, gearbox: "Manual" }).price);
});
Deno.test("gb1: X3 M40i is priced from X3/X4 M40i evidence (family level), above a standard automatic X3", () => {
  const std = valueWithOwnComps({ ...X3, gearbox: "Automatic" } as any);
  const m40 = valueWithOwnComps({ ...X3, gearbox: "Automatic", variant: "M40i", adText: "M40i" } as any);
  assertEquals(m40.perfKey, "bmw-m");
  assert(m40.level === "model" || m40.level === "family", m40.level);
  assert(m40.privatePrice > std.privatePrice, `${m40.privatePrice} vs ${std.privatePrice}`);
});
