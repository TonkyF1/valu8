// Pure selection rules for the MarketCheck comparable-listings cascade in analyse-vehicle.
// The cascade used to run tiers one after another and stop at the first good one. Tiers are now fetched in
// small parallel waves, but the pick is made by these functions with exactly the same rule, so results match.

export interface HasListings { listings: unknown[] }
const n = (r: HasListings | null | undefined) => (r ? r.listings.length : 0);

/**
 * results[i] = tier i's result (null = failed / no data), possibly only the first few tiers so far.
 * mins[i]    = listings needed to accept tier i. total = number of tiers; the LAST tier is the wide net.
 * Rule (identical to the sequential cascade): take the first tier, in order, with >= its minimum;
 * if none does, the wide tier wins only when it has MORE listings than the tier just before it,
 * otherwise the tier just before it is returned (even if null / thin).
 * done=false means "ask for more tiers"; done=true means pick is final.
 */
export function pickMcTier<T extends HasListings>(
  results: (T | null | undefined)[], mins: number[], total: number,
): { done: boolean; pick: T | null } {
  for (let i = 0; i < total - 1; i++) {
    if (i >= results.length) return { done: false, pick: null };
    const r = results[i];
    if (r && n(r) >= mins[i]) return { done: true, pick: r };
  }
  if (results.length < total) return { done: false, pick: null };
  const prev = total >= 2 ? results[total - 2] ?? null : null;
  const wide = results[total - 1] ?? null;
  return { done: true, pick: wide && n(wide) > n(prev) ? wide : prev };
}

/**
 * Candidate model names, in order: first with >= 3 listings wins; otherwise the one with the most listings
 * (earlier candidate wins ties), same as the old sequential loop.
 */
export function pickMcCandidate<T extends HasListings>(results: (T | null | undefined)[]): T | null {
  let best: T | null = null;
  for (const r of results) {
    if (r && n(r) >= 3) return r;
    if (r && n(r) > n(best)) best = r;
  }
  return best;
}
