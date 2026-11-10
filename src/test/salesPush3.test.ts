import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { joinMakeModel, valueModelName, VALUE_MODELS } from "@/data/valueModels";
import { valueBodyHtml, valueMeta, valueName, yearBodyHtml, yearMeta } from "@/data/valuePages";
import { getAnyRouteMeta } from "@/data/allRoutes";

const byslug = (s: string) => MODEL_PRICES.find((m) => m.slug === s)!;

describe("make and model names", () => {
  it("never doubles the make", () => {
    expect(joinMakeModel("DS", "DS 3")).toBe("DS 3");
    expect(joinMakeModel("DS", "DS 4")).toBe("DS 4");
    expect(joinMakeModel("Mazda", "3")).toBe("Mazda 3");
    expect(joinMakeModel("Mini", "Mini Cooper")).toBe("Mini Cooper");
    expect(joinMakeModel("Ford", "Focus")).toBe("Ford Focus");
    for (const m of VALUE_MODELS) {
      const n = valueModelName(m);
      const first = m.make.split(" ")[0];
      expect(n.toLowerCase().startsWith(`${first} ${first} `.toLowerCase())).toBe(false);
    }
  });
  it("no page copy says a make twice in a row", () => {
    for (const m of MODEL_PRICES) {
      const re = new RegExp(`\\b${m.make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${m.make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const meta = valueMeta(m);
      expect(re.test(valueBodyHtml(m) + meta.title + meta.description), m.slug).toBe(false);
      const y = m.years[0];
      if (y) { const ym = yearMeta(m, y); expect(re.test(yearBodyHtml(m, y) + ym.title + ym.description), m.slug).toBe(false); }
      expect(re.test(getAnyRouteMeta(`/value/${m.slug}`)?.title ?? ""), m.slug).toBe(false);
    }
  });
  it("model CTAs include the make", () => {
    const mazda = byslug("mazda-3");
    expect(valueName(mazda)).toBe("Mazda 3");
    expect(valueBodyHtml(mazda)).toContain("Value my Mazda 3 free");
    expect(valueBodyHtml(mazda)).not.toMatch(/Value my 3 free/);
    expect(valueBodyHtml(byslug("ds-ds-3"))).toContain("Value my DS 3 free");
    for (const m of MODEL_PRICES) expect(valueBodyHtml(m)).toContain(`Value my ${valueName(m)} free`);
  });
});

describe("no accuracy claims in changed user-facing copy", () => {
  const files = [
    "src/components/PhotoUploader.tsx", "src/pages/NewValuation.tsx", "src/components/SaleFeedbackCard.tsx",
    "src/components/ValuationFeedbackCard.tsx", "src/components/AdvertFollowupCard.tsx", "src/components/ReportCheckout.tsx",
  ];
  it.each(files)("%s", (f) => {
    const src = readFileSync(f, "utf8");
    expect(src).not.toMatch(/most accurate|more accurate|accurate valuation|exact (price|value|valuation)|precise (price|value|valuation)|guaranteed (price|value)/i);
  });
  it("photo uploader wording", () => {
    expect(readFileSync("src/components/PhotoUploader.tsx", "utf8")).toContain("Six key shots help us value it properly.");
  });
});
