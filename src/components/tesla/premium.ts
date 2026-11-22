/** Premium Valuation Report (£2.99) copy. Only things the paid report really contains. */
import type { Intent } from "@/lib/intent";

export const PREMIUM_NAME = "Premium Valuation Report";
export const PREMIUM_TITLE = "Premium Valuation Report · £2.99";
export const PREMIUM_CTA = "Unlock Premium Report · £2.99";
export const PREMIUM_REASSURE = "One-off payment. No subscription.";
/** Money-back promise (wording approved by Tony, 21 Nov 2026). Shown wherever someone can pay. */
export const MONEY_BACK = "Not useful? Email us within 14 days for a full refund.";
/**
 * Consumer Contracts Regulations 2013 (reg. 37): express consent to immediate supply of digital content and
 * acknowledgement that the statutory cancellation right is lost once it is supplied. Shown next to every pay button.
 */
export const DIGITAL_CONSENT = "By paying, you ask us to supply your report straight away and agree that you lose your right to cancel once it has been supplied. Our 14-day money-back promise still applies.";

/** Selling view: unchanged from the original seller report. */
export const PREMIUM_INCLUDES = [
  "A suggested asking price for your advert",
  "The lowest offer to accept",
  "Advert text ready to post",
  "A PDF of the report to keep",
  "The UK adverts we compared the car with",
  "Repair cost bands for the MOT advisories",
  "What a buyer will spot, from the MOT record and photos",
  "Selling tips: where to sell, what to highlight, documents to have ready",
];

/** Buying view: same valuation, framed for a buyer (src/lib/buyerGuide.ts). */
export const PREMIUM_INCLUDES_BUYING = [
  "An estimated fair price for the car",
  "A suggested opening offer",
  "An indicative negotiation range",
  "How the advertised asking price compares",
  "The UK adverts we compared the car with",
  "Repair cost bands for the MOT advisories",
  "What to check, from the MOT record and mileage",
  "A PDF of the report to keep",
];

export const includesFor = (i: Intent) => (i === "buying" ? PREMIUM_INCLUDES_BUYING : PREMIUM_INCLUDES);

/** Homepage premium section: the six headline benefits per view (all delivered by the paid report). */
export const BENEFITS: Record<Intent, { heading: string; body: string; items: string[] }> = {
  buying: {
    heading: "Know what to pay before you buy.",
    body: "Understand a car’s estimated market value, compare it with the asking price and approach negotiations with greater confidence.",
    items: ["Estimated fair market value", "Suggested opening offer", "Indicative negotiation range", "Comparison with the advertised asking price, where provided", "Relevant MOT and mileage insights", "Downloadable PDF report"],
  },
  selling: {
    heading: "Know what to ask before you sell.",
    body: "Choose a realistic asking price, understand your negotiating position and prepare an advert that helps attract potential buyers.",
    items: ["Suggested advertised asking price", "Estimated achievable selling range", "Negotiation guidance", "Ready-to-use vehicle advert", "Vehicle valuation and condition insights", "Downloadable PDF report"],
  },
};

/** Line under the details-step buttons. */
export const includesLine = (i: Intent) => (i === "buying"
  ? "Report includes a fair price, an opening offer, a negotiation range and a PDF"
  : "Report includes a suggested asking price, the lowest offer to accept, advert text and a PDF");

/** Locked rows on the free result card (labels only, never real figures). */
export const LOCKED_ROWS: Record<Intent, { label: string; money: boolean }[]> = {
  buying: [{ label: "Suggested opening offer", money: true }, { label: "Negotiation range", money: true }, { label: "Asking price check", money: false }, { label: "PDF report to keep", money: false }],
  selling: [{ label: "Suggested asking price", money: true }, { label: "Lowest offer to accept", money: true }, { label: "Ready-to-post advert", money: false }, { label: "PDF report to keep", money: false }],
};
