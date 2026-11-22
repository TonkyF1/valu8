import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { computeFit, FitPrice, splitRange } from "@/components/FitPrice";
import { fitFontSize } from "@/lib/pdfPremium";

const flow = readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8");
const css = readFileSync("src/styles/tesla.css", "utf8");
const premium = readFileSync("src/components/report/PremiumView.tsx", "utf8");
const report = readFileSync("src/pages/Report.tsx", "utf8");

afterEach(() => { vi.restoreAllMocks(); });

const realGcs = window.getComputedStyle.bind(window);
const mockStyle = () => vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => new Proxy(realGcs(el), {
  get(t, p) {
    if (p === "fontSize") return "40px";
    if (p === "paddingLeft" || p === "paddingRight") return "0px";
    const v = Reflect.get(t, p);
    return typeof v === "function" ? v.bind(t) : v;
  },
}));

describe("computeFit (big price auto-fit)", () => {
  it("keeps the CSS size when the price already fits", () => {
    expect(computeFit({ avail: 340, base: 41, w1: 160, w2: 0, minPx: 30, floorPx: 16 })).toEqual({ fontSize: null, split: false });
  });
  it("scales a long single figure down to fit", () => {
    const r = computeFit({ avail: 300, base: 41, w1: 330, w2: 0, minPx: 30, floorPx: 16 });
    expect(r.split).toBe(false);
    expect(r.fontSize!).toBeLessThan(41);
    expect((r.fontSize! / 41) * 330).toBeLessThanOrEqual(300);
  });
  it("wraps a range to two lines rather than going below the readable size", () => {
    // £4,023,700–£4,882,500 on a 375px phone: one line would need ~24px.
    const r = computeFit({ avail: 330, base: 41, w1: 560, w2: 300, minPx: 30, floorPx: 16 });
    expect(r).toEqual({ fontSize: null, split: true });
  });
  it("scales the two-line layout too on very narrow screens, never below the floor", () => {
    const r = computeFit({ avail: 260, base: 34, w1: 560, w2: 300, minPx: 30, floorPx: 16 });
    expect(r.split).toBe(true);
    expect((r.fontSize! / 34) * 300).toBeLessThanOrEqual(260);
    expect(computeFit({ avail: 10, base: 34, w1: 560, w2: 300, minPx: 30, floorPx: 16 }).fontSize).toBe(16);
  });
  it("prefers one line when the scaled range is still readable", () => {
    const r = computeFit({ avail: 900, base: 64, w1: 1000, w2: 500, minPx: 30, floorPx: 16 });
    expect(r.split).toBe(false);
    expect(r.fontSize!).toBeGreaterThanOrEqual(30);
  });
  it("does nothing before layout (no width yet)", () => {
    expect(computeFit({ avail: 0, base: 41, w1: 500, w2: 0, minPx: 30, floorPx: 16 })).toEqual({ fontSize: null, split: false });
  });
});

describe("splitRange", () => {
  it("splits low – / high and leaves single figures alone", () => {
    expect(splitRange("£4,023,700–£4,882,500")).toEqual(["£4,023,700\u00A0–", "£4,882,500"]);
    expect(splitRange("£4,023,700 – £4,882,500")).toEqual(["£4,023,700\u00A0–", "£4,882,500"]);
    expect(splitRange("£12,345,678")).toBeNull();
  });
});

describe("FitPrice component", () => {
  it("measures the final text, exposes it to screen readers and renders lines through the render prop", () => {
    render(<FitPrice text="£4,023,700–£4,882,500" className="t8-price" testId="fp">{(lines) => lines.map((l, i) => <b key={i}>{l}</b>)}</FitPrice>);
    expect(screen.getByRole("text", { name: "£4,023,700–£4,882,500" })).toBeTruthy();
    const box = screen.getByTestId("fp");
    expect(box.textContent).toContain("£4,882,500");
    // Hidden measure copy carries the same class (so it starts from the CSS size) and the two split lines.
    const measure = box.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(measure.className).toBe("t8-price");
    expect(measure.style.visibility).toBe("hidden");
    expect(measure.children.length).toBe(3);
  });
  it("shrinks when the box is narrower than the price", () => {
    const ow = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) { return this.textContent?.length ? this.textContent.length * 20 : 0; });
    const cw = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    const gcs = mockStyle();
    render(<FitPrice text="£12,345,678" className="x" testId="fp2" />);
    const vis = screen.getByRole("text", { name: "£12,345,678" });
    const size = parseFloat(vis.style.fontSize);
    expect(size).toBeGreaterThan(0);
    expect((size / 40) * 11 * 20).toBeLessThanOrEqual(200);
    expect(vis.style.whiteSpace).toBe("nowrap");
    ow.mockRestore(); cw.mockRestore(); gcs.mockRestore();
  });
  it("goes to two lines for a long range on a narrow box", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) { return this.textContent?.length ? this.textContent.length * 20 : 0; });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    mockStyle();
    render(<FitPrice text="£4,023,700–£4,882,500" className="x" minPx={30} />);
    const vis = screen.getByRole("text", { name: "£4,023,700–£4,882,500" });
    expect(vis.dataset.fitSplit).toBe("1");
    expect(vis.style.flexDirection).toBe("column");
    expect(vis.textContent).toContain("£4,023,700\u00A0–");
  });
});

describe("wired into every big price", () => {
  it("Tesla flow odometer sits in a full-width fit box (sized on the final value)", () => {
    expect(flow).toMatch(/<FitPrice key=\{refined \? "r" : "e"\} text=\{bandText\(band\)\} className="t8-price"/);
    expect(flow).toMatch(/lines\.map\(\(l, i\) => <RollingPrice key=\{i\} text=\{l\} \/>\)/);
    expect(css).toMatch(/\.t8-readout\{[^}]*width:100%/);
    expect(css).toMatch(/\.t8-pricebox\{padding:0 16px/);
    expect(css).toMatch(/\.t8-price\{font-family:'Sora',Inter,sans-serif;font-weight:200/);
  });
  it("report and premium report headline prices fit", () => {
    expect(report).toMatch(/<FitPrice text=\{`£\$\{normaliseReportPricing\(r\)\.privateSale\.toLocaleString\(\)\}`\}/);
    // Premium Report: the hero figure and every plan tile fit their box (one FitPrice in the hero, one in Stat).
    expect(premium.match(/<FitPrice /g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(premium).toMatch(/testId="premium-price"/);
  });
  it("PDF prices shrink to their box", () => {
    const sizes: number[] = [];
    let cur = 0;
    const doc = { setFontSize: (n: number) => { cur = n; sizes.push(n); }, getTextWidth: (t: string) => t.length * cur * 0.55 };
    const s = fitFontSize(doc, "£12,345,678", 80, 16, 8);
    expect(s).toBeLessThan(16);
    expect("£12,345,678".length * s * 0.55).toBeLessThanOrEqual(80);
    expect(fitFontSize(doc, "£8,200", 141, 16, 8)).toBe(16);
  });
});
