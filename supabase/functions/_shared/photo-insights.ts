// Validation of AI vision line items (photoInsights). Shared by analyse-vehicle
// (before pricing) and the report renderer (so stored reports are cleaned too).

export type InsightLike = {
  observation?: string | null;
  priceImpact?: number | string | null;
  fixable?: boolean | null;
  fixCost?: number | null;
  photoIndex?: number | null;
  severity?: string | null;
  slot?: string | null;

};

const DAMAGE_WORDS = ["scuff", "scratch", "dent", "ding", "chip", "scrape", "kerb", "crack", "rust", "corrosion", "tear", "stain", "mark"];
const NEGATED_DAMAGE = new RegExp(`\\b(?:no|without|free of|free from|zero)\\s+(?:visible\\s+|obvious\\s+|noticeable\\s+|major\\s+|severe\\s+|significant\\s+)?(?:[a-z]+\\s+){0,2}?(${DAMAGE_WORDS.join("|")})`, "i");
// Line items whose evidence is a document (MOT/history/advert), not the photo.
// Those signals are already priced by the MOT/service adjustments.
const NON_PHOTO_EVIDENCE = /\b(mot|advis(?:ory|ories|ed)|service history|declared|advert|listing|logbook|v5)\b/i;
// Mileage is priced once, by the comps correction + high-mileage curve.
const MILEAGE_TEXT = /\b(mileage|odometer|miles|mi\b|high[- ]mile)/i;

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
export function jaccard(a: string, b: string): number {
  const A = words(a); const B = words(b);
  if (!A.size || !B.size) return 0;
  let i = 0; for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i);
}

function damageWordsIn(s: string): string[] {
  const l = s.toLowerCase();
  return DAMAGE_WORDS.filter((w) => l.includes(w));
}

/**
 * Validate vision line items:
 *  - drop items with no real observation (zero evidence);
 *  - strip £ impacts that rest on non-photo evidence (MOT text), mileage, or that
 *    contradict another observation of the same photo ("no visible scuffs");
 *  - strip a deduction reused on a second, near-identical item;
 *  - `fixable` only when there is a negative impact to recover.
 */
export function validatePhotoInsights<T extends InsightLike>(items: T[] | null | undefined): T[] {
  const list = Array.isArray(items) ? items : [];
  const kept: T[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const obs = String(raw.observation ?? "").trim();
    if (obs.replace(/[^a-z]/gi, "").length < 10) continue;
    const it: T = { ...raw, observation: obs };
    let impact = Number(it.priceImpact);
    if (!Number.isFinite(impact)) impact = 0;
    impact = Math.round(impact);
    const strip = () => { impact = 0; };

    if (impact !== 0 && NON_PHOTO_EVIDENCE.test(obs)) strip();
    if (impact < 0 && MILEAGE_TEXT.test(obs)) strip();
    if (impact < 0 && /^positive$/i.test(String(it.severity ?? ""))) strip();
    if (impact < 0 && NEGATED_DAMAGE.test(obs)) strip(); // "no scuffs" can't be a deduction
    if (impact < 0) {
      // Contradicted by another observation of the same photo.
      const dw = damageWordsIn(obs);
      const same = list.filter((o) => o !== raw && o?.photoIndex != null && o.photoIndex === it.photoIndex);
      if (dw.length && same.some((o) => { const m = String(o?.observation ?? "").match(NEGATED_DAMAGE); return !!m && dw.includes(m[1].toLowerCase()); })) strip();
    }
    if (impact !== 0) {
      // Same deduction reused on a near-duplicate item.
      const dup = kept.find((k) => Number(k.priceImpact) === impact && (jaccard(String(k.observation), obs) >= 0.5 || (k.photoIndex === it.photoIndex && k.slot === it.slot && damageWordsIn(String(k.observation)).some((w) => damageWordsIn(obs).includes(w)))));
      if (dup) strip();
    }
    // Drop exact/near-duplicate observations entirely.
    if (kept.some((k) => jaccard(String(k.observation), obs) >= 0.8)) continue;

    if (impact === 0) delete (it as InsightLike).priceImpact; else (it as InsightLike).priceImpact = impact;
    (it as InsightLike).fixable = impact < 0 && it.fixable === true;
    if (!(it as InsightLike).fixable) delete (it as InsightLike).fixCost;
    kept.push(it);
  }
  return kept;
}

/** Upside if every fixable item is fixed: sum of their deductions (computed, never AI-supplied). */
export function fixableUpside(items: InsightLike[] | null | undefined): number {
  return (items ?? []).reduce((s, i) => {
    const n = Number(i?.priceImpact);
    return s + (i?.fixable === true && Number.isFinite(n) && n < 0 ? Math.abs(Math.round(n)) : 0);
  }, 0);
}
