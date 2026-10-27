/**
 * One coherent price model for the report. Everything is derived from the
 * realistic private-sale figure (the central value) plus spreads, and the
 * ordering below is ENFORCED so the headline, slider, legend and copy can
 * never contradict each other (including old saved reports):
 *
 *   tradeIn < privateLow ≤ privateSale ≤ privateHigh ≤ askLow ≤ askHigh ≤ retail
 *   askLow = privateSale + buffer   (buffer text == actual gap)
 *   privateHigh is capped at askLow, so the ask range touches/sits just above it.
 */
export type CoherentInput = {
  privateSale: number;
  tradeIn?: number | null;
  retail?: number | null;
  privateLow?: number | null;
  privateHigh?: number | null;
  buffer?: number | null;
};

export type CoherentPricing = {
  tradeIn: number;
  privateLow: number;
  privateSale: number;
  privateHigh: number;
  askLow: number;
  askHigh: number;
  retail: number;
  buffer: number;
  /** Slider scale: always trade-in → retail. */
  scaleLow: number;
  scaleHigh: number;
};

const r50 = (v: number) => Math.round(v / 50) * 50;
const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Max shown dealer-retail multiple of the private estimate. */
export function retailCapMultiplier(privateSale: number): number {
  return privateSale < 10000 ? 1.25 : 1.2;
}

export function coherentPricing(input: CoherentInput): CoherentPricing {
  // One rounded headline figure everywhere (no £5,637 vs £5,650 mismatches).
  const P = r50(input.privateSale);
  const g = 50;
  // Buffer: 2–8% of the realistic figure, default ~4%, min £100.
  const rawBuf = fin(input.buffer) ? input.buffer : P * 0.04;
  const buffer = Math.max(100, r50(Math.min(P * 0.08, Math.max(P * 0.02, rawBuf))));
  let askLow = P + buffer;
  let askHigh = askLow + Math.max(2 * g, r50(buffer));

  // Retail must sit at/above the ask range; if the stored retail is lower, raise it.
  // Shown dealer retail stays in a sensible band above private: never more than
  // private × 1.25 under £10k (× 1.20 above), never below private × 1.08.
  const capMult = retailCapMultiplier(P);
  const rawRetail = fin(input.retail) ? Math.round(input.retail) : r50(P * 1.18);
  const bandedRetail = Math.min(Math.max(rawRetail, r50(P * 1.08)), Math.floor((P * capMult) / g) * g);
  const retail = Math.max(bandedRetail, askHigh);
  askHigh = Math.min(askHigh, retail);
  askLow = Math.min(askLow, askHigh);

  // Private range around P, capped so it never runs past the start of the ask range.
  let privateHigh = fin(input.privateHigh) ? Math.round(input.privateHigh) : r50(P * 1.04);
  privateHigh = Math.min(Math.max(privateHigh, P), askLow);
  let privateLow = fin(input.privateLow) ? Math.round(input.privateLow) : r50(P * 0.95);
  privateLow = Math.min(privateLow, P);

  // Trade-in strictly below the private range.
  let tradeIn = fin(input.tradeIn) ? Math.round(input.tradeIn) : r50(P * 0.85);
  if (tradeIn >= privateLow) {
    // Prefer lifting the private low (keeps the dealer figure), else drop trade-in.
    if (tradeIn + g <= P) privateLow = tradeIn + g;
    else tradeIn = Math.max(0, privateLow - g);
  }

  // Final invariant: the realistic sale (headline/marker) ALWAYS sits inside the
  // highlighted private range — widen the range to include it if needed.
  if (privateLow > P) privateLow = P;
  if (privateHigh < P) privateHigh = P;
  if (tradeIn >= privateLow) tradeIn = Math.max(0, privateLow - g);

  return {
    tradeIn, privateLow, privateSale: P, privateHigh, askLow, askHigh, retail,
    buffer: askLow - P, scaleLow: tradeIn, scaleHigh: retail,
  };
}
