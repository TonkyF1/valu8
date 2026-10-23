/** Geometry for the report's price band. Every bar and the marker share ONE scale (trade-in → retail). */
export interface BandInput {
  scaleLow: number; scaleHigh: number;
  privateLow: number; privateHigh: number;
  askLow: number; askHigh: number;
  privateSale: number;
}
export interface Seg { left: number; width: number }
export interface BandGeometry { pill: Seg; ask: Seg; marker: number }

/** Minimum visible pill width in % of the track, so very narrow ranges still show. */
export const MIN_PILL_PCT = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function seg(lo: number, hi: number, pct: (v: number) => number): Seg {
  let l = pct(Math.min(lo, hi));
  let r = pct(Math.max(lo, hi));
  if (r - l < MIN_PILL_PCT) {
    const c = (l + r) / 2;
    l = clamp(c - MIN_PILL_PCT / 2, 0, 100 - MIN_PILL_PCT);
    r = l + MIN_PILL_PCT;
  }
  return { left: l, width: r - l };
}

export function priceBandGeometry(i: BandInput): BandGeometry {
  const span = Math.max(1, i.scaleHigh - i.scaleLow);
  const pct = (v: number) => clamp(((v - i.scaleLow) / span) * 100, 0, 100);
  const pill = seg(i.privateLow, i.privateHigh, pct);
  const ask = seg(i.askLow, i.askHigh, pct);
  // The marker (realistic private sale) is always drawn inside the green private-range pill.
  const marker = clamp(pct(i.privateSale), pill.left, pill.left + pill.width);
  return { pill, ask, marker };
}
