import { describe, expect, it } from "vitest";
import { adTitle, formatForMarketplace, plain } from "@/lib/marketplace";

const v = { make: "Ford", model: "Focus · 1.0 EcoBoost Titanium", year: 2018, mileage: 45200, price: 9995, location: "Leeds" };

describe("marketplace formatting", () => {
  it("builds a readable title", () => {
    expect(adTitle(v)).toBe("2018 Ford Focus 1.0 EcoBoost Titanium 45k miles");
  });
  it("truncates eBay titles to 80 chars", () => {
    const long = { ...v, model: "X".repeat(120) };
    const out = formatForMarketplace("ebay", "Body", long);
    const title = out.split("\n")[0].replace("TITLE: ", "");
    expect(title.length).toBeLessThanOrEqual(80);
  });
  it("strips markdown", () => {
    expect(plain("## Heading\n**Bold** text\n- item")).toBe("Heading\nBold text\n• item");
  });
  it("facebook keeps it short and adds location + price", () => {
    const out = formatForMarketplace("facebook", "One.\n\nTwo.\n\nThree.", v);
    expect(out).toContain("£9,995");
    expect(out).toContain("Leeds");
    expect(out).not.toContain("Three.");
  });
});
