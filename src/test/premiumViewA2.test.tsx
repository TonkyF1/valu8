import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { PriceMovers } from "@/components/report/PriceMovers";
import { PREMIUM_NAME, PREMIUM_TITLE } from "@/components/tesla/premium";
import type { PriceMover } from "@/lib/priceMovers";

const mv = (key: string, pct: number | null = null): PriceMover => ({ key, label: `Label ${key}`, detail: `Detail ${key}`, pct, tone: pct == null ? "neutral" : pct < 0 ? "down" : "up" } as PriceMover);

describe("A2: Premium Report", () => {
  it("one product name everywhere", () => {
    expect(PREMIUM_NAME).toBe("Premium Report");
    expect(PREMIUM_TITLE).toBe("Premium Report · £2.99");
    for (const f of ["src/pages/Report.tsx", "src/components/ReportCheckout.tsx", "src/components/tesla/TeslaFlow.tsx", "src/components/report/LockedSection.tsx", "src/components/ShareCard.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Premium Valuation Report|Full Report"/);
    }
  });
  it("no emojis or 'exclusive · datapoints' badges in the report", () => {
    for (const f of ["src/pages/Report.tsx", "src/components/AdvertCreator.tsx", "src/components/report/ReportParts.tsx", "src/components/report/PremiumView.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/💡|✍️|Valu8 exclusive|datapoints scanned/);
    }
  });
  it("paid reports render the dedicated Premium view instead of the standard page", () => {
    const s = readFileSync("src/pages/Report.tsx", "utf8");
    expect(s).toContain("const premiumView = premium && !valuationUnavailable;");
    expect(s).toContain("{premiumView ? (");
    expect(s).not.toContain("<PremiumReport ");
  });
  it("homepage marketing steps aside once a car is on screen", () => {
    const s = readFileSync("src/pages/Landing.tsx", "utf8");
    expect(s).toContain("<TeslaFlow onFlowChange={setInFlow} />");
    expect(s.indexOf("{!inFlow && (<>")).toBeLessThan(s.indexOf("<FreeVsPremium />"));
    expect(s.indexOf("</>)}")).toBeGreaterThan(s.indexOf("popularValueModels()"));
    expect(readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8")).toContain("useEffect(() => { onFlowChange?.(hasCar); }, [hasCar, onFlowChange]);");
  });
  it("the report page uses the rich checkout sheet", () => {
    const s = readFileSync("src/components/ReportCheckout.tsx", "utf8");
    expect(s).toContain("<CheckoutSheet title={PREMIUM_TITLE}");
    expect(s).toContain("intro={<CheckoutIntro car={car} intent={intent} />}");
  });
});

describe("PriceMovers expandable", () => {
  it("shows five reasons, expands the rest, and reveals each detail on tap", () => {
    render(<PriceMovers expandable movers={[mv("mot-expired", -20), mv("a", -2), mv("b"), mv("c"), mv("d"), mv("e"), mv("f")]} />);
    expect(screen.getByText("Detail mot-expired")).toBeTruthy();
    expect(screen.queryByText("Detail a")).toBeNull();
    expect(screen.queryByText("Label f")).toBeNull();
    fireEvent.click(screen.getByText("Show 2 more reasons"));
    expect(screen.getByText("Label f")).toBeTruthy();
    const btn = screen.getByText("Label a").closest("button")!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Detail a")).toBeTruthy();
    cleanup();
  });
});
