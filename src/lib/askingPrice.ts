import { coherentPricing, type CoherentPricing } from "../../supabase/functions/_shared/coherentPricing";
import { reportPriceRange, formatPriceRange, type PriceRange } from "../../supabase/functions/_shared/cheapRange";

/**
 * Suggested asking range shown on the report. Always sits ABOVE the realistic
 * private-sale figure so the seller has room to negotiate down to it:
 * low ≈ private +5%, high ≈ private +15%, rounded up to £50 (under £10k) or £100.
 */
export function askGrain(value: number): number {
  return value < 10000 ? 50 : 100;
}

export function roundUpTo(value: number, grain: number): number {
  return Math.ceil(value / grain) * grain;
}

export function suggestedAskRange(privateSale: number): { low: number; high: number } {
  if (!Number.isFinite(privateSale) || privateSale <= 0) return { low: 0, high: 0 };
  const grain = askGrain(privateSale);
  let low = roundUpTo(privateSale * 1.05, grain);
  if (low <= privateSale) low = roundUpTo(privateSale + grain, grain);
  let high = roundUpTo(privateSale * 1.15, grain);
  if (high <= low) high = low + grain * 2;
  return { low, high };
}

/** True when the valuation had at least one uploaded photo (condition score is only meaningful then). */
export function hasPhotos(photoUrls: unknown): boolean {
  return Array.isArray(photoUrls) && photoUrls.filter(Boolean).length > 0;
}

/**
 * Frontend normalisation: rebuild every report figure from one coherent model so
 * old saved reports (generated before the backend enforced ordering) display consistently.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseReportPricing(r: any): CoherentPricing {
  const cp = coherentPricing({
    privateSale: Number(r?.values?.privateSale) || 0,
    tradeIn: Number(r?.values?.dealerTradeIn) || null,
    retail: Number(r?.values?.dealerRetail) || null,
    privateLow: r?.valueRange?.privateSaleLow ?? null,
    privateHigh: r?.valueRange?.privateSaleHigh ?? null,
    buffer: r?.negotiationBuffer || r?.recommendations?.negotiationBuffer || null,
  });
  // Display guard: headline realistic sale must sit inside the green private range.
  const privateLow = Math.min(cp.privateLow, cp.privateSale);
  const privateHigh = Math.max(cp.privateHigh, cp.privateSale);
  const tradeIn = cp.tradeIn >= privateLow ? Math.max(0, privateLow - 50) : cp.tradeIn;
  return { ...cp, privateLow, privateHigh, tradeIn, scaleLow: Math.min(cp.scaleLow, tradeIn) };
}

/**
 * The one private-sale range every report surface prints (Report page, Premium report, both PDFs): the headline range
 * from cheapRange.reportPriceRange when it applies (under £5,000 or 16y+), else the normalised comps band.
 * `text` uses the Report page's format, e.g. "£2,200 – £3,700".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function displayPrivateRange(r: any): { low: number; high: number; mid: number; headline: PriceRange | null; text: string } {
  const p = normaliseReportPricing(r);
  const headline = reportPriceRange(r, p.privateSale);
  const low = headline?.low ?? p.privateLow, high = headline?.high ?? p.privateHigh;
  return { low, high, mid: p.privateSale, headline, text: formatPriceRange({ low, high, mid: p.privateSale, rule: "" }, " – ") };
}

const RANGE_NUM = "£\\s?[\\d,]+(?:\\.\\d+)?";
const RANGE_SEP = "\\s*(?:[–—-]|to)\\s*";
const MENTION_RES: RegExp[] = [
  new RegExp(`\\(\\s*typically\\s+${RANGE_NUM}${RANGE_SEP}${RANGE_NUM}\\s*\\)`, "gi"),
  new RegExp(`\\btypically\\s+${RANGE_NUM}${RANGE_SEP}${RANGE_NUM}`, "gi"),
  new RegExp(`\\brange(?:\\s+of)?\\s+${RANGE_NUM}${RANGE_SEP}${RANGE_NUM}`, "gi"),
];
const MENTION_KEYS = ["headline", "valueReasoning", "honestAnalysis", "marketContext", "marketPositioning"] as const;

/**
 * AI-written prose can quote the narrow comps band ("typically £2,500–£2,850") while the page shows the headline range.
 * When a headline range applies, rewrite those mentions to the displayed range. Asking-range wording ("List at £a–£b")
 * and the sellerTip are never touched. Returns a new object; no-op when no headline range applies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function alignRangeMentions<T extends Record<string, any>>(r: T): T {
  if (!r || typeof r !== "object" || r.valuationUnavailable || !r.values) return r;
  const d = displayPrivateRange(r);
  if (!d.headline) return r;
  const text = formatPriceRange({ low: d.low, high: d.high, mid: d.mid, rule: "" }, "–");
  const out: Record<string, any> = { ...r };
  for (const k of MENTION_KEYS) {
    const v = out[k];
    if (typeof v !== "string") continue;
    out[k] = v
      .replace(MENTION_RES[0], `(typically ${text})`)
      .replace(MENTION_RES[1], `typically ${text}`)
      .replace(MENTION_RES[2], (m) => (/^range\s+of/i.test(m) ? `range of ${text}` : `range ${text}`));
  }
  return out as T;
}

/** Only show an asking/listing figure that is a real positive number (never "–"). */
export function hasAskFigure(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}
