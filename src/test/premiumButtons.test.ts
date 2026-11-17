import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PREMIUM_INCLUDES, PREMIUM_TITLE } from "@/components/tesla/premium";
import { REPORT_ADDS } from "@/components/ReportCheckout";

const flow = readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8");

function copyOk(t: string) {
  expect(t).not.toContain("—");
  expect(t).not.toMatch(/gumtree|autotrader|webuyanycar|motorway|cazoo|carwow/i);
  expect(t).not.toMatch(/\baccura(te|cy)\b|\bexact\b|guarantee|precise/i);
}

describe("two-button premium flow", () => {
  it("checkout title and includes list", () => {
    expect(PREMIUM_TITLE).toBe("Premium Report · £2.99");
    expect(PREMIUM_INCLUDES).toHaveLength(8);
    [PREMIUM_TITLE, ...PREMIUM_INCLUDES].forEach(copyOk);
    // Same 8 things the paid report already lists (REPORT_ADDS), so nothing is promised that isn't delivered.
    expect(REPORT_ADDS).toHaveLength(PREMIUM_INCLUDES.length);
  });
  it("landing and details show both buttons with the approved wording", () => {
    for (const s of ["Free Valuation", "Finish Valuation", "Premium Report<small>£2.99 one-off</small>", "Buying or Selling, Know the right price", "We don't buy cars", "Check another plate"]) expect(flow).toContain(s);
    expect(flow).not.toContain("Update with my details");
    expect(flow).not.toContain("No account needed");
    expect(flow.match(/data-testid="premium-(landing|details)"/g)).toHaveLength(2);
  });
});
