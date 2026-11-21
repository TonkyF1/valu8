// Sitemap <lastmod> dates (W3C YYYY-MM-DD) for every page in the sitemap that isn't a /value page.
// Each date is the last day the page's main, crawlable content really changed (from git history), not the
// build date. Bump a page's date here whenever you change its visible copy; leave it alone for styling,
// app-flow or code-only changes. /value pages use VALUE_PAGES_MODIFIED_ISO (valuePages.ts) instead.
// Node-safe: imported by scripts/sitemap.ts at build time. src/test/sitemapLastmod.test.ts keeps it complete.

export const PAGE_LASTMOD: Record<string, string> = {
  "/": "2026-11-21", // prerendered intro no longer repeats the removed hero tagline
  "/check": "2026-11-17", // guest limit copy
  "/car-values": "2026-11-18", // hub lists /value pages
  "/pricing": "2026-11-18", // part-ex and dealer figures moved to the £2.99 Full report
  "/how-it-works": "2026-11-20", // new page (Tony approved the sitemap URL 20 Nov)
  "/faq": "2026-11-20", // new page
  "/example-report": "2026-11-20", // new page
  "/about": "2026-11-06",
  "/contact": "2026-11-06",
  "/privacy": "2026-11-20", // carVertical registration line
  "/terms": "2026-11-17",
  "/disclaimers": "2026-11-06",
  "/embed-info": "2026-11-10",
  "/guides": "2026-11-10", // three guides added
  "/guides/what-is-my-car-worth": "2026-11-18",
  "/guides/part-exchange-vs-private-sale": "2026-11-18",
  "/guides/how-to-tell-if-a-used-car-is-overpriced": "2026-11-17",
  "/guides/how-to-sell-a-car-privately-safely": "2026-11-18",
  "/guides/check-mot-and-mileage-history-before-buying": "2026-11-10",
  "/guides/part-exchange-offer-too-low": "2026-11-18",
  "/guides/mot-advisories-car-value": "2026-11-18",
  "/guides/how-to-price-a-car-for-private-sale": "2026-11-10",
  "/guides/what-lowers-a-cars-value": "2026-11-10",
  "/guides/private-sale-vs-dealer-prices": "2026-11-10",
};

/** /car-values/<make>/<model> pages with no /value match (indexable, in the sitemap). None today. */
export const CAR_VALUE_PAGES_MODIFIED_ISO = "2026-11-18";
