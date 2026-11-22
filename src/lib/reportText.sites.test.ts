import { describe, expect, it } from "vitest";
import { neutraliseSites } from "./reportText";

describe("neutraliseSites", () => {
  it("replaces a slash list ending in a multi-word site whole", () => {
    expect(neutraliseSites("Gumtree / Facebook Marketplace (expect fast local queries)")).toBe("major UK car sites (expect fast local queries)");
  });
  it("replaces a list that starts with a multi-word site", () => {
    expect(neutraliseSites("Try Facebook Marketplace/Gumtree for a quick sale")).toBe("Try major UK car sites for a quick sale");
  });
  it("keeps the word before a slash list", () => {
    expect(neutraliseSites("List on eBay/Gumtree today")).toBe("List on major UK car sites today");
  });
  it("leaves other site lists alone and dedupes", () => {
    expect(neutraliseSites("Auto Trader, Gumtree and Gumtree.com")).toBe("Auto Trader, major UK car sites");
    expect(neutraliseSites("Auto Trader Private (strongest return)")).toBe("Auto Trader Private (strongest return)");
  });
});
