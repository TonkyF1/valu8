// Recompute the 12 test cars with the calibrated engine and print error vs asking price.
// Run: npx tsx scripts/backtest.ts
// Private sellers are compared on privateSale; the dealer car on dealerRetail.
import { BACKTEST_CARS } from "../src/test/fixtures/backtest-cars";
import { recomputeCar } from "../src/test/fixtures/backtest-engine";

const pct = (v: number, ask: number) => `${v >= ask ? "+" : ""}${(((v - ask) / ask) * 100).toFixed(1)}%`;
const rows = BACKTEST_CARS.map((c) => {
  const n = recomputeCar(c);
  const oldCmp = c.seller === "dealer" ? c.oldRetail : c.oldPrivate;
  const newCmp = c.seller === "dealer" ? n.retail : n.privateSale;
  return { car: c.name, seller: c.seller, ask: c.ask, old: oldCmp, oldErr: pct(oldCmp, c.ask), new: newCmp, newErr: pct(newCmp, c.ask), askRange: `${n.ask.low}-${n.ask.high}`, notes: n.notes.join("; ") };
});
console.table(rows);
const mae = (k: "old" | "new") => rows.reduce((s, r) => s + Math.abs((r[k] - r.ask) / r.ask), 0) / rows.length;
console.log(`Mean abs error vs ask: old ${(mae("old") * 100).toFixed(1)}% -> new ${(mae("new") * 100).toFixed(1)}%`);
