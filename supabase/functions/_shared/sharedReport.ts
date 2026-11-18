// Which report a viewer of /valuation/:id gets from get-shared-valuation.
// Full report: the owner, or any viewer once the valuation is paid for / unlocked (report-entitlement).
// Everyone else gets Essentials only: paid Full Report fields are stripped server-side.

export function fullReportAllowed(isOwner: boolean, paid: boolean): boolean {
  return isOwner || paid;
}

/** What a viewer gets: owner = everything; paid non-owner = full report minus the owner's private sale feedback; else Essentials. */
export function reportForViewer(raw: unknown, isOwner: boolean, paid: boolean) {
  if (isOwner) return raw;
  if (!fullReportAllowed(isOwner, paid)) return stripSharedReport(raw);
  if (!raw || typeof raw !== "object") return raw;
  const { saleFeedback: _sf, ...rest } = raw as Record<string, unknown>;
  return rest;
}

export function stripSharedReport(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const { saleFeedback: _sf, advert: _ad, photoInsights: _pi,
    recommendedAskingPrice: _rap, negotiationBuffer: _nb,
    conditionScore: _cs, conditionLabel: _cl,
    repairEstimate: _re, repairEstimates: _res, advisoryCosts: _ac,
    fixableUpside: _fu, ...rest } = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rest };
  if (Array.isArray(out.comparableListings)) {
    out.comparableListings = (out.comparableListings as unknown[])
      // deno-lint-ignore no-explicit-any
      .filter((c: any) => c && c.price > 0)
      .slice(0, 3);
  }
  if (out.recommendations && typeof out.recommendations === "object") {
    const rec = { ...(out.recommendations as Record<string, unknown>) };
    delete rec.recommendedAskingPrice;
    delete rec.negotiationBuffer;
    delete rec.listingPrice;
    out.recommendations = rec;
  }
  return out;
}
