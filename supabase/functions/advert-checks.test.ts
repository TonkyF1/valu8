import { describe, expect, it } from "vitest";
import { isDenylisted, sanitiseLink } from "./_shared/adverts";
import { extractPrice, isAllowed, parseRobots } from "./_shared/robots";

describe("advert link denylist", () => {
  it("never marks AutoTrader (or its subdomains) fetchable", () => {
    expect(sanitiseLink("https://www.autotrader.co.uk/car-details/123?x=1")?.fetchable).toBe(false);
    expect(isDenylisted("m.autotrader.co.uk")).toBe(false || isDenylisted("m.autotrader.co.uk"));
    expect(isDenylisted("m.autotrader.co.uk")).toBe(true);
  });
  it("blocks Facebook, eBay and any domain containing 'auction'", () => {
    expect(isDenylisted("facebook.com")).toBe(true);
    expect(isDenylisted("ebay.com")).toBe(true);
    expect(isDenylisted("bobs-car-auctions.co.uk")).toBe(true);
  });
  it("allows Gumtree", () => {
    expect(sanitiseLink("https://www.gumtree.com/p/cars/x/123")?.fetchable).toBe(true);
  });
  it("strips the query string and fragment", () => {
    expect(sanitiseLink("https://www.gumtree.com/p/1?utm=a#top")?.url).toBe("https://www.gumtree.com/p/1");
  });
});

describe("robots.txt", () => {
  const txt = "User-agent: *\nDisallow: /\n\nUser-agent: Valu8Bot\nAllow: /p/\nDisallow: /\nCrawl-delay: 15";
  it("uses the Valu8Bot group when present", () => {
    const r = parseRobots(txt, "Valu8Bot/1.0");
    expect(isAllowed(r, "/p/cars/1")).toBe(true);
    expect(isAllowed(r, "/search")).toBe(false);
    expect(r.crawlDelay).toBe(15);
  });
  it("falls back to *", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /", "Valu8Bot"), "/p/1")).toBe(false);
  });
});

describe("price extraction", () => {
  it("reads JSON-LD offers.price", () => {
    expect(extractPrice('<script type="application/ld+json">{"@type":"Car","offers":{"price":"8,995"}}</script>')).toBe(8995);
  });
  it("reads og:price:amount", () => {
    expect(extractPrice('<meta property="og:price:amount" content="7500">')).toBe(7500);
  });
});
