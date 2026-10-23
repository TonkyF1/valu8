import { describe, it, expect } from "vitest";
// @ts-expect-error plain ESM script without types
import { parseGumtreePage, merge, toCsv, parseCsv, mapEbayItem, fingerprint } from "../../scripts/harvest/collect.mjs";

const ad = (id: number, price: string, seller = "Private") => ({
  id, title: "Ford, FIESTA, Hatchback, 2012", price, path: `/p/ford/x/${id}`, location: "Newport, Gwent", shortDescription: "Lovely car\n12 months mot",
  attributes: [["vehicle_make", "Ford"], ["vehicle_model", "FIESTA"], ["vehicle_registration_year", "2012"], ["vehicle_mileage", "90000"], ["seller_type", seller],
    ["vehicle_fuel_type", "Petrol"], ["vehicle_transmission", "Manual"], ["vehicle_body_type", "Hatchback"], ["vehicle_engine_size", "1242"], ["vrn", "AB12CDE"]].map(([key, value]) => ({ key, value })),
});
const page = (ads: unknown[]) => `<script>x="${encodeURIComponent(JSON.stringify({ resultsPage: { searchAds: ads } }))}"</script>"tr":2`;

describe("harvest collector", () => {
  it("parses Gumtree search pages, keeps town only and never stores the reg", () => {
    const { ads } = parseGumtreePage(page([ad(1804000001, "£1,395.00"), ad(1804000002, "£8,000.00", "Trade")]));
    expect(ads).toHaveLength(2);
    expect(ads[0]).toMatchObject({ source: "gumtree", listing_id: "1804000001", make: "Ford", model: "Fiesta", year: "2012", mileage: "90000", price: 1395, seller_type: "private", location: "Newport", engine_cc: "1242" });
    expect(ads[1].seller_type).toBe("dealer");
    expect(JSON.stringify(ads)).not.toContain("AB12CDE");
    expect(parseGumtreePage(page([{ ...ad(3, "£500.00"), shortDescription: "reg AB12 CDE runs" }])).ads[0].desc).toBe("reg [reg] runs");
  });

  it("dedupes across sources and infers a sale price after 14 days unseen", () => {
    const g = parseGumtreePage(page([ad(1, "£1,000.00")])).ads;
    const e = { ...g[0], source: "ebay", listing_id: "999" };
    let { rows, newBySource } = merge([], [...g, e], "2026-10-01");
    expect(rows.find((r: any) => r.source === "ebay").status).toBe("duplicate");
    expect(newBySource).toEqual({ gumtree: 1, ebay: 1 });
    ({ rows } = merge(rows, [], "2026-10-14"));
    expect(rows[0].status).toBe("active");
    ({ rows } = merge(rows, [], "2026-10-16"));
    expect(rows[0]).toMatchObject({ status: "delisted", sold_price_inferred: 1000, first_seen: "2026-10-01", last_seen: "2026-10-01" });
    ({ rows } = merge(rows, g, "2026-10-20"));
    expect(rows[0]).toMatchObject({ status: "active", sold_price_inferred: "", last_seen: "2026-10-20" });
  });

  it("round-trips CSV with quotes and commas", () => {
    const r = { source: "gumtree", listing_id: "1", desc: 'say "hi", ok\nnew', price: 5 };
    expect(parseCsv(toCsv([r]))[0]).toMatchObject({ source: "gumtree", listing_id: "1", desc: 'say "hi", ok\nnew', price: "5" });
  });

  it("maps eBay Browse API items", () => {
    const r = mapEbayItem({ legacyItemId: "123", itemWebUrl: "https://www.ebay.co.uk/itm/123?x=1", price: { value: "2450.00" }, seller: { sellerAccountType: "INDIVIDUAL" }, itemLocation: { city: "Leeds" },
      localizedAspects: [{ name: "Manufacturer", value: "Toyota" }, { name: "Model", value: "YARIS" }, { name: "Year", value: "2011" }, { name: "Mileage", value: "84,000 miles" }] });
    expect(r).toMatchObject({ source: "ebay", listing_id: "123", url: "https://www.ebay.co.uk/itm/123", make: "Toyota", model: "Yaris", year: 2011, mileage: 84000, price: 2450, seller_type: "private", location: "Leeds" });
    expect(fingerprint(r)).toBe("toyota|yaris|2011|84000|2450");
  });
});

describe("seller type + make normalisation", () => {
  it("uses Gumtree trade signals and dealer text cues", async () => {
    const m = await import("../../scripts/harvest/collect.mjs");
    expect(m.sellerType({ sellerAttr: "Trade" })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", proAccount: true })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", isTrade: true })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", vat: "No VAT" })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", text: "Lovely car, finance available, part exchange welcome" })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", text: "Reliable Motors - quality cars" })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", text: "6 months warranty included" })).toBe("dealer");
    expect(m.sellerType({ sellerAttr: "Private", text: "Sold as seen, no warranty. New battery with 3 years warranty. No finance." })).toBe("private");
    expect(m.sellerType({ sellerAttr: "Private", text: "Corsa limited edition, px welcome" })).toBe("private");
  });
  it("normalises make names", async () => {
    const m = await import("../../scripts/harvest/collect.mjs");
    expect(m.normMake("Mg")).toBe("MG");
    expect(m.normMake("Mg Motor Uk")).toBe("MG");
    expect(m.normMake("MG Motor UK")).toBe("MG");
    expect(m.normMake("mercedes benz")).toBe("Mercedes-Benz");
    expect(m.normMake("ford")).toBe("Ford");
  });
});
