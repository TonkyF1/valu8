import { assert, assertEquals } from "jsr:@std/assert@1";
import { motSignals, motAdjustment } from "./motSignals.ts";
const now = new Date("2026-10-24T12:00:00Z");
const pass = (date: string, mileage: number, expiryDate: string, advisories: string[] = []) => ({ date, result: advisories.length ? "Advisory" : "Pass", mileage, expiryDate, advisories, failures: [] });
const fail = (date: string, mileage: number, failures: string[] = ["Brake disc worn"]) => ({ date, result: "Fail", mileage, failures, advisories: [] });

Deno.test("no history -> neutral", () => { const a = motAdjustment(motSignals([], { now }), 3000); assertEquals(a.pct, 0); assertEquals(a.factor, 1); });
Deno.test("clean long history with long MOT is a small positive, bounded", () => {
  const e = [pass("2026-09-01", 60000, "2027-08-31"), pass("2025-09-01", 52000, "2026-08-31"), pass("2024-09-01", 44000, "2025-08-31")];
  const s = motSignals(e, { now, year: 2014 })!; assert(s.cleanHistory); assertEquals(s.expiryStatus, "long"); assert(Math.abs(s.recentAnnualMiles! - 8000) < 20);
  const cheap = motAdjustment(s, 1500), dear = motAdjustment(s, 12000);
  assertEquals(cheap.pct, 7); assertEquals(dear.pct, 1); assert(cheap.pct <= cheap.bounds[1]);
});
Deno.test("standing fail with no MOT left hits cheap cars hardest", () => {
  const e = [fail("2026-10-01", 120000, ["Excessive corrosion sill", "Oil leak"]), pass("2025-09-01", 110000, "2026-08-31")];
  const s = motSignals(e, { now })!; assert(s.noValidMot); assert(s.serious.corrosion && s.serious.oilLeak);
  const a = motAdjustment(s, 1500), b = motAdjustment(s, 4000), c = motAdjustment(s, 9000);
  assertEquals(a.pct, -35); assert(b.pct >= -25 && b.pct < -20, String(b.pct)); assertEquals(c.pct, -15);
  assert(a.pct < b.pct && b.pct < c.pct);
});
Deno.test("odometer drop flags clocking risk", () => {
  const e = [pass("2026-06-01", 50000, "2027-05-31"), pass("2025-06-01", 81000, "2026-05-31"), pass("2024-06-01", 75000, "2025-05-31")];
  const s = motSignals(e, { now })!; assert(s.mileageAnomaly); assertEquals(s.mileageDrop, 31000);
  assert(motAdjustment(s, 6000).parts.some((p) => p.key === "odometer_drop"));
});
Deno.test("recent fixed fail + many advisories + due soon", () => {
  const adv = ["Tyre worn close to legal limit", "Front brake pads wearing thin", "Suspension arm bush deteriorated", "Exhaust has minor leak"];
  const e = [pass("2025-11-10", 90000, "2026-11-09", adv), fail("2025-11-10", 90000)];
  const s = motSignals(e, { now })!; assertEquals(s.expiryStatus, "due_soon"); assertEquals(s.failsLast2, 1); assertEquals(s.advisoriesLatest, 4);
  const a = motAdjustment(s, 3000); assert(a.pct < 0 && a.pct >= -25, String(a.pct));
  assertEquals(a.parts.map((p) => p.key).sort(), ["advisories", "mot_due_soon", "recent_fails", "serious_items"]);
});
Deno.test("test gap and high recent use", () => {
  const e = [pass("2026-03-01", 70000, "2027-02-28"), pass("2023-01-01", 30000, "2023-12-31")];
  const s = motSignals(e, { now })!; assert(s.testGap); assert(!s.highRecentUse);
  const h = motSignals([pass("2026-03-01", 70000, "2027-02-28"), pass("2025-03-01", 50000, "2026-02-28")], { now })!; assert(h.highRecentUse);
});
