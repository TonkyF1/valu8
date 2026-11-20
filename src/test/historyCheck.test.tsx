import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryCheckButton, HISTORY_CHECK_URL, HISTORY_CHECK_DISCLOSURE } from "@/components/report/HistoryCheckButton";

describe("carVertical history check button", () => {
  const html = renderToStaticMarkup(<HistoryCheckButton />);
  it("links to exactly the affiliate URL as a plain anchor", () => {
    expect(HISTORY_CHECK_URL).toBe("https://www.carvertical.deal/4BZC6ZM/5DKLH2/?source_id=AFF&sub1=valu8_result");
    expect(html).toContain('href="https://www.carvertical.deal/4BZC6ZM/5DKLH2/?source_id=AFF&amp;sub1=valu8_result"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toMatch(/<iframe/i);
  });
  it("rel includes sponsored and noopener", () => {
    expect(html).toMatch(/rel="[^"]*\bsponsored\b[^"]*"/);
    expect(html).toMatch(/rel="[^"]*\bnoopener\b[^"]*"/);
  });
  it("shows the disclosure and no discount wording", () => {
    expect(HISTORY_CHECK_DISCLOSURE).toBe("Affiliate link: Valu8 earns a commission if you buy.");
    expect(html).toContain("Affiliate link: Valu8 earns a commission if you buy.");
    expect(html).toContain("Full vehicle history check");
    expect(html).not.toMatch(/discount|cashback|% off/i);
  });
});
