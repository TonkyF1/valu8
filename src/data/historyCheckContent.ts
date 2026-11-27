// /car-history-check copy: one source for the React page (CarHistoryCheck.tsx) and the build-time HTML + FAQ schema.
// Every claim about the carVertical report is taken from carVertical's own public UK site (carvertical.com/gb,
// checked 27 Nov 2026). Node-safe (no React, no browser APIs).
import { escapeHtml } from "../../scripts/routeHtml";
import { faqPageJsonLd, type SiteFaq } from "./siteFaqs";

export const HISTORY_PAGE_PATH = "/car-history-check";
export const HISTORY_PAGE_H1 = "Car history check";
export const HISTORY_PAGE_INTRO =
  "A free Valu8 valuation tells you what a car is worth. A carVertical history check tells you what it's been through: outstanding finance, write-offs, theft records and mileage rollbacks, before you hand over any money.";

/** What a carVertical report can uncover, as listed on carvertical.com/gb. "If available" is carVertical's own wording. */
export const HISTORY_COVERS: [string, string][] = [
  ["Outstanding finance", "Records of outstanding finance or other legal issues, so you don't buy a car that still belongs to a lender."],
  ["Write-offs and damage", "Write-off categories (like Cat S or N) and damage records, with where and when it happened and what repairs might have cost, if that data is available."],
  ["Theft records", "Whether the car has been recorded as stolen."],
  ["Mileage rollbacks", "Recorded mileage readings over time, to spot a clocked car."],
  ["Past photos", "Photos of the car's past condition, when available."],
  ["Ownership and use", "Ownership changes and commercial use history."],
  ["Service and safety", "Maintenance records, safety information, and specs and equipment."],
  ["Market price and running costs", "Market price and emission taxes, alongside a carVertical score for how clean the history looks."],
];

export const HISTORY_WHY: [string, string][] = [
  ["MOT history isn't the whole story", "Valu8 already shows the free DVSA MOT history. It can't tell you about finance, insurance write-offs or theft. A history check fills that gap."],
  ["Cheap for what it can save", "A car with hidden finance can be repossessed, and a clocked or written-off car is worth far less than it looks. Check before you pay a deposit."],
  ["Use it to negotiate", "If the report turns up past damage or a mileage gap, you have something concrete to talk the price down with, or a reason to walk away."],
];

export const HISTORY_COUPON_NOTE = "Use code valu8 at carVertical's checkout. It's applied automatically when you go through our link.";

export const HISTORY_FAQS: SiteFaq[] = [
  { q: "What does a carVertical history check show?", a: "A carVertical report can show outstanding finance records, write-off categories and damage, theft records, recorded mileage and rollbacks, past photos, ownership changes, maintenance, specs and equipment, market price and emission taxes, where that data is available." },
  { q: "Is the history check free?", a: "No. The Valu8 valuation and the DVSA MOT history are free. The carVertical history check is a paid report bought on carVertical's own site. Use code valu8, which is applied automatically through our link." },
  { q: "What do I need to run a check?", a: "Just the car's registration (or its 17-digit VIN). Enter the reg above and we'll open carVertical's check for that car." },
  { q: "How quickly do I get the report?", a: "carVertical says its report is generated in about 40 seconds after payment." },
  { q: "What if carVertical has no data for the car?", a: "carVertical says that if no data is found, your report is returned automatically." },
  { q: "Does Valu8 get paid if I buy?", a: "Yes. This is an affiliate link: Valu8 earns a commission if you buy, at no extra cost to you. It doesn't change your valuation in any way. We only pass carVertical the registration, nothing else." },
  { q: "How is this different from the Valu8 report?", a: "Valu8 tells you what the car is worth and what to offer or ask. carVertical checks its past: finance, write-offs, theft and mileage. Used together, you know the right price and that the car is what it claims to be." },
];

export const HISTORY_DISCLOSURE_LONG = "Affiliate link: Valu8 earns a commission if you buy, at no extra cost to you. Only the registration you enter is passed to carVertical.";

const p = (t: string) => `<p>${escapeHtml(t)}</p>`;

/** Build-time body (React replaces it on mount). Same copy as the page. */
export function historyCheckBodyHtml(): string {
  const covers = `<ul>${HISTORY_COVERS.map(([h, t]) => `<li><strong>${escapeHtml(h)}</strong>: ${escapeHtml(t)}</li>`).join("")}</ul>`;
  const why = HISTORY_WHY.map(([h, t]) => `<h3>${escapeHtml(h)}</h3>${p(t)}`).join("");
  const faqs = HISTORY_FAQS.map((f) => `<h3>${escapeHtml(f.q)}</h3>${p(f.a)}`).join("");
  return `<main id="main"><header><h1>${escapeHtml(HISTORY_PAGE_H1)}</h1>${p(HISTORY_PAGE_INTRO)}</header>`
    + `<section><h2>What a carVertical check covers</h2>${covers}</section>`
    + `<section><h2>Why check before you buy</h2>${why}</section>`
    + `<section><h2>Coupon code</h2>${p(HISTORY_COUPON_NOTE)}</section>`
    + `<section><h2>Questions</h2>${faqs}</section>`
    + `<section><h2>Know the price too</h2><p><a href="/">Get a free valuation by registration</a> or <a href="/check">check an advert's asking price</a>.</p>${p(HISTORY_DISCLOSURE_LONG)}</section></main>`;
}

export const HISTORY_FAQ_JSONLD_ID = "history-faq-jsonld";
export const historyCheckHeadHtml = () => `<script type="application/ld+json" id="${HISTORY_FAQ_JSONLD_ID}">${faqPageJsonLd(HISTORY_FAQS)}</script>`;
