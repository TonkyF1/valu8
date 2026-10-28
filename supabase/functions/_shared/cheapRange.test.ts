import { assert, assertEquals } from "jsr:@std/assert@1";
import { cheapPriceRange, reportPriceRange, headlinePrivateText, CHEAP_RANGE } from "./cheapRange.ts";

Deno.test("cheap range: tiers, rounding, asymmetric", () => {
  assertEquals(cheapPriceRange(1000), { low: 700, high: 1500, mid: 1000, rule: CHEAP_RANGE.RULE });
  assertEquals(cheapPriceRange(3000), { low: 2400, high: 4100, mid: 3000, rule: CHEAP_RANGE.RULE });
  const r = cheapPriceRange(4950)!;
  assert(r.low <= 4950 && r.high >= 4950 && r.low % 100 === 0 && r.high % 100 === 0);
  assert(cheapPriceRange(150)!.low >= 50);
});

Deno.test("cheap range: none at £5,000+ or for bad input", () => {
  assertEquals(cheapPriceRange(5000), null);
  assertEquals(cheapPriceRange(12000), null);
  assertEquals(cheapPriceRange(0), null);
  assertEquals(cheapPriceRange(NaN), null);
  assertEquals(cheapPriceRange(undefined), null);
});

Deno.test("report range: stored range preferred, recomputed for old reports, single figure above £5k", () => {
  assertEquals(reportPriceRange({ values: { privateSale: 1000 }, priceRange: { low: 650, high: 1550, rule: "x" } })!.low, 650);
  assertEquals(reportPriceRange({ values: { privateSale: 1000 } })!.high, 1500);
  assertEquals(reportPriceRange({ values: { privateSale: 1000 }, priceRange: { low: 2000, high: 3000 } })!.low, 700); // inconsistent -> recompute
  assertEquals(reportPriceRange({ values: { privateSale: 8000 } }), null);
  assertEquals(reportPriceRange({ values: { privateSale: 1000 }, valuationUnavailable: true }), null);
  assertEquals(headlinePrivateText(1000), "£700–£1,500");
  assertEquals(headlinePrivateText(8000), "£8,000");
});

import { buildReportEmail } from "./emailTemplates.ts";
Deno.test("emails: range under £5k, single figure above", () => {
  const cheap = buildReportEmail("valuation", { id: "x", make: "Ford", model: "Fiesta", report: { values: { privateSale: 1000, dealerTradeIn: 600, dealerRetail: 1500 } } }, "https://u");
  assert(cheap.text.includes("£700") && cheap.text.includes("£1,500"));
  const dear = buildReportEmail("valuation", { id: "x", make: "Ford", model: "Fiesta", report: { values: { privateSale: 9000, dealerTradeIn: 7000, dealerRetail: 11000 } } }, "https://u");
  assert(dear.text.includes("£9,000"));
  const adv = buildReportEmail("advert", { id: "y", make: "Ford", model: "Ka", estimate_private: 1000, asking_price: 1200 }, "https://u");
  assert(adv.text.includes("£700 – £1,500"));
});
