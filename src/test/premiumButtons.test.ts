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
    for (const s of ["Free Valuation", "Finish Valuation", "Premium Report<small>£2.99 one-off</small>", "Buying or selling? Know the right price.", "We don't buy cars", "Check another plate"]) expect(flow).toContain(s);
    expect(flow).not.toContain("Update with my details");
    expect(flow).not.toContain("No account needed");
    expect(flow.match(/data-testid="premium-(landing|details)"/g)).toHaveLength(2);
  });
  it("landing Premium Report goes to the details step (no checkout) and shows one Pay button there", () => {
    expect(flow).toContain("Pay for Premium Report<small>£2.99 one-off</small>");
    expect(flow).toContain('data-testid="pay-premium"');
    // The landing path goes to the details step instead of opening checkout; the car lands at the top of the page.
    expect(flow).not.toMatch(/openPremium\("landing"/);
    expect(flow).not.toMatch(/if \(premium\) setTimeout\(\(\) => detailsRef\.current\?\.scrollIntoView/);
    expect(flow).toMatch(/if \(view === "details" && from === "entry"\) scrollPageTop\(\)/);
    // Single button submits the form in the premium path; the free path keeps both buttons.
    expect(flow).toContain("onSubmit={(e) => void refine(e, premiumBusy)}");
    expect(flow).toMatch(/premiumBusy \? \(\s*<div className=\{`t8-solo/);
    // Unpriced-car safeguard: checkout only opens when the report has a price, and says so otherwise (never silent).
    expect(flow).toMatch(/function openPremium[\s\S]{0,160}if \(report !== null && !bandFor\(report\)\) \{ setPayErr\(UNPRICEABLE\); return; \}/);
  });
});
