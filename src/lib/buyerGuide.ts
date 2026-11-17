/**
 * Buyer guidance for the £2.99 report, derived only from figures the valuation already has
 * (private sale estimate and range, part-exchange and dealer retail). It never changes those
 * figures or the engine; it just frames them for someone buying.
 *
 * The asking-price check follows the same idea as the free /check advert tool (advertCheck.ts):
 * below the private range = cheap, inside it = in line, between private and dealer level = room to
 * negotiate, above dealer level = high. Here it uses this car's own valuation instead of a fresh
 * make/model market lookup, so no extra API call is needed.
 */
export interface BuyerInputs { privateSale: number; privateLow?: number | null; privateHigh?: number | null; tradeIn?: number | null; retail?: number | null }

export interface BuyerGuide {
  /** Estimated fair price for a private sale (the existing private sale estimate). */
  fairPrice: number;
  privateLow: number;
  privateHigh: number;
  /** Suggested first offer. */
  openingOffer: number;
  /** Indicative negotiation range: open at the low end, aim to settle well before the high end. */
  rangeLow: number;
  rangeHigh: number;
  /** Typical dealer retail level, when the valuation has one. */
  dealerRetail: number | null;
}

export type AskingVerdict = "below" | "in_line" | "room" | "above_dealer";

export interface AskingComparison { verdict: AskingVerdict; asking: number; diff: number; diffPct: number }

const grainOf = (v: number) => (v < 10000 ? 50 : 100);
const floorTo = (v: number, g: number) => Math.floor(v / g) * g;
const roundTo = (v: number, g: number) => Math.round(v / g) * g;
const pos = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Opening offer sits about 7% under the fair price, never below the part-exchange level. */
export const OPENING_FACTOR = 0.93;

export function buyerGuide(p: BuyerInputs, asking?: number | null): BuyerGuide | null {
  const ps = pos(p.privateSale);
  if (!ps) return null;
  const g = grainOf(ps);
  const privateLow = Math.min(pos(p.privateLow) ?? ps, ps);
  const privateHigh = Math.max(pos(p.privateHigh) ?? ps, ps);
  const tradeIn = pos(p.tradeIn);
  const ask = pos(asking ?? null);

  let opening = floorTo(Math.max(ps * OPENING_FACTOR, tradeIn && tradeIn < ps ? tradeIn : 0), g);
  if (opening >= ps) opening = floorTo(ps - g, g);
  // Asking price already at or under our usual opening: open a little under the asking price instead.
  if (ask && ask <= opening) opening = floorTo(ask * 0.95, g);
  opening = Math.max(g, opening);

  let rangeHigh = Math.max(roundTo(privateHigh, g), ps);
  if (rangeHigh === ps && privateHigh === ps) rangeHigh = roundTo(ps * 1.03, g);
  // No reason to pay more than the seller is asking.
  if (ask && ask < rangeHigh) rangeHigh = Math.round(ask);
  if (rangeHigh <= opening) rangeHigh = opening + g;

  return { fairPrice: ps, privateLow, privateHigh, openingOffer: opening, rangeLow: opening, rangeHigh, dealerRetail: pos(p.retail) };
}

export function compareAsking(asking: number, g: BuyerGuide): AskingComparison | null {
  const a = pos(asking);
  if (!a) return null;
  const verdict: AskingVerdict =
    a < g.privateLow * 0.97 ? "below"
    : a <= g.privateHigh ? "in_line"
    : g.dealerRetail && a > g.dealerRetail * 1.02 ? "above_dealer"
    : "room";
  const diff = Math.round(a - g.fairPrice);
  return { verdict, asking: Math.round(a), diff, diffPct: Math.round((diff / g.fairPrice) * 100) };
}

export const VERDICT_COPY: Record<AskingVerdict, { label: string; tip: string }> = {
  below: { label: "Below the estimate", tip: "Priced under our estimated private sale range. Check the condition, history and paperwork closely before you commit." },
  in_line: { label: "In line with the estimate", tip: "The asking price sits within our estimated private sale range. There may still be a little room to negotiate." },
  room: { label: "Room to negotiate", tip: "Above our private sale estimate but not above typical dealer prices. Start with the opening offer and work within the range." },
  above_dealer: { label: "Above typical dealer prices", tip: "Higher than typical dealer asking prices for similar cars. Negotiate firmly or keep looking." },
};

/** "£795 above the estimated fair price" style line. */
export function diffLine(c: AskingComparison): string {
  const gbp = (n: number) => `£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
  if (Math.abs(c.diff) < 1) return "Matches the estimated fair price";
  return `${gbp(c.diff)} ${c.diff > 0 ? "above" : "below"} the estimated fair price`;
}

export function parseAsking(v: string): number | null {
  const n = Number(String(v).replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n >= 100 && n <= 2_000_000 ? Math.round(n) : null;
}
