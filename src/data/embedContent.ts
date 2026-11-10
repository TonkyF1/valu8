// Node-safe copy for /embed-info (React page + build-time HTML). The widget itself is the static
// file public/embed/index.html; submitting it opens valu8.uk with the reg prefilled and
// ?utm_source=embed&utm_campaign=<site>.
export const EMBED_URL = "https://valu8.uk/embed/";

/** Same rule as the funnel's utm cleaner: lowercase letters, digits, _ . + - only, max 64. */
export function embedSiteParam(site: string): string {
  return site.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/\s+/g, "_").replace(/[^a-z0-9_.+-]/g, "").slice(0, 64);
}

export function embedSnippet(site: string, light = false): string {
  const s = embedSiteParam(site) || "your-site";
  return `<iframe src="${EMBED_URL}?site=${s}${light ? "&theme=light" : ""}" title="What's my car worth? Free valuation by Valu8" width="100%" height="250" style="border:0;max-width:520px" loading="lazy"></iframe>`;
}

export const EMBED_INFO = {
  h1: "Add a free \"What's my car worth?\" box to your site",
  intro: "A small number plate box your visitors can use to value their car for free. It takes one line of code, costs nothing and needs no sign-up.",
  sections: [
    ["Who it's for", [
      "Garages and MOT centres: customers often ask what their car is worth before they decide on repairs.",
      "Car blogs and owners' clubs: a useful tool next to buying and selling articles.",
      "Local community and motoring sites that want something practical for readers.",
    ]],
    ["What your visitors get", [
      "They type their reg and Valu8 opens in a new tab with it filled in.",
      "A free private sale estimate, plus the car's official DVSA MOT history.",
      "No account needed. An optional full report is available on valu8.uk for a one-off £2.99.",
    ]],
    ["What it doesn't do", [
      "No advertising or analytics cookies and no tracking inside the box. Your site name is only passed along in the link so we can see which sites send visitors.",
      "We don't buy, sell or broker cars, so nobody gets a call from a car buyer.",
      "There's no fee and no contract. Remove the code whenever you like.",
    ]],
  ] as [string, string[]][],
  faqs: [
    ["Is it free?", "Yes. The box and the valuation are free. There's nothing to sign up for."],
    ["Will it slow my site down?", "It's a separate page loaded in an iframe, and the code loads it lazily, so it only loads when someone scrolls near it."],
    ["Can I change how it looks?", "There's a dark version and a light version for pale backgrounds. Tick the light option above before you copy the code."],
    ["Who do I contact?", "Email hello@valu8.uk if you'd like a different size or have a question."],
  ] as [string, string][],
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Crawler HTML for /embed-info (same copy as the React page). */
export function embedInfoBodyHtml(): string {
  const secs = EMBED_INFO.sections.map(([h, items]) => `<h2>${esc(h)}</h2><ul>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`).join("");
  const faqs = EMBED_INFO.faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
  return `<main id="main"><h1>${esc(EMBED_INFO.h1)}</h1><p>${esc(EMBED_INFO.intro)}</p><h2>Add it to your site</h2><pre><code>${esc(embedSnippet(""))}</code></pre>${secs}<h2>Questions</h2>${faqs}</main>`;
}
