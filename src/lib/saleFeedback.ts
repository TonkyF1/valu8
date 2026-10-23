/**
 * "What did it sell for?" feedback loop.
 * Stored on the owner's own valuation row at report.saleFeedback (jsonb) — owner-only via
 * the existing "Users update own valuations" RLS policy; stripped from buyer share views.
 */
export type SoldTo = "private" | "dealer" | "part_ex";

export interface SaleFeedback {
  salePrice: number;
  soldOn?: string | null; // YYYY-MM-DD
  soldTo?: SoldTo | null;
  recordedAt: string; // ISO
  estimateAtTime?: number | null; // private-sale estimate when recorded, for accuracy maths
}

export const SOLD_TO_LABELS: Record<SoldTo, string> = {
  private: "Private buyer",
  dealer: "Dealer",
  part_ex: "Part-exchange",
};

export const PROMPT_AFTER_DAYS = 14;
const MAX_PRICE = 2_000_000;

export interface SaleFeedbackInput { salePrice: string | number; soldOn?: string | null; soldTo?: string | null }

/** Validate raw form input. Returns an error message or the cleaned values. */
export function validateSaleFeedback(
  input: SaleFeedbackInput,
  now: Date = new Date(),
): { ok: true; value: Omit<SaleFeedback, "recordedAt" | "estimateAtTime"> } | { ok: false; error: string } {
  const raw = typeof input.salePrice === "number" ? String(input.salePrice) : (input.salePrice ?? "");
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return { ok: false, error: "Enter the price it sold for" };
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter a valid price in pounds" };
  if (n > MAX_PRICE) return { ok: false, error: "That price looks too high — please check it" };
  let soldOn: string | null = null;
  if (input.soldOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.soldOn) || isNaN(new Date(`${input.soldOn}T00:00:00`).getTime()))
      return { ok: false, error: "Enter a valid sale date" };
    const d = new Date(`${input.soldOn}T00:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d.getTime() > today.getTime()) return { ok: false, error: "Sale date can't be in the future" };
    soldOn = input.soldOn;
  }
  let soldTo: SoldTo | null = null;
  if (input.soldTo) {
    if (!(input.soldTo in SOLD_TO_LABELS)) return { ok: false, error: "Choose who you sold to" };
    soldTo = input.soldTo as SoldTo;
  }
  return { ok: true, value: { salePrice: Math.round(n), soldOn, soldTo } };
}

export function getSaleFeedback(report: unknown): SaleFeedback | null {
  const f = (report as { saleFeedback?: unknown } | null)?.saleFeedback as SaleFeedback | undefined;
  return f && typeof f.salePrice === "number" && f.salePrice > 0 ? f : null;
}

/** Merge feedback into an existing report without touching anything else. */
export function withSaleFeedback<T extends Record<string, unknown>>(report: T | null | undefined, fb: SaleFeedback | null): T {
  const next = { ...(report || {}) } as Record<string, unknown>;
  if (fb) next.saleFeedback = fb; else delete next.saleFeedback;
  return next as T;
}

/** Remove owner-only feedback before showing a report to anyone else. */
export function stripSaleFeedback<T>(report: T): T {
  if (!report || typeof report !== "object") return report;
  const { saleFeedback: _omit, ...rest } = report as Record<string, unknown>;
  return rest as T;
}

/** Gentle dashboard nudge: valuation is ≥14 days old, has a value, and no feedback yet. */
export function needsSaleFeedbackPrompt(
  row: { created_at: string; private_value?: number | null; report?: unknown },
  now: Date = new Date(),
): boolean {
  if (getSaleFeedback(row.report)) return false;
  if ((row.report as { valuationUnavailable?: boolean } | null)?.valuationUnavailable) return false;
  if (!row.private_value) return false;
  const created = new Date(row.created_at).getTime();
  if (isNaN(created)) return false;
  return now.getTime() - created >= PROMPT_AFTER_DAYS * 86400000;
}

/** Signed % difference of sale vs estimate (positive = sold above estimate). */
export function saleAccuracy(salePrice: number, estimate: number | null | undefined): number | null {
  if (!estimate || estimate <= 0 || !(salePrice > 0)) return null;
  return Math.round(((salePrice - estimate) / estimate) * 1000) / 10;
}
