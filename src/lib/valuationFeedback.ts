/**
 * "Does this sound right?" feedback under a valuation result.
 * Saved through the submit_valuation_feedback RPC (owner-only: signed-in user or the guest token
 * that made the valuation). A signal for the Valu8 team only — it never changes a price.
 */
export type Verdict = "too_low" | "about_right" | "too_high";

export const VERDICT_LABELS: Record<Verdict, string> = {
  too_low: "Too low",
  about_right: "About right",
  too_high: "Too high",
};
export const VERDICTS: Verdict[] = ["too_low", "about_right", "too_high"];

export const ESTIMATE_MIN = 100;
export const ESTIMATE_MAX = 500_000;

export interface ValuationFeedbackState {
  verdict: Verdict | null;
  user_estimate: number | null;
  followup_opt_in: boolean;
}

export function isVerdict(v: unknown): v is Verdict {
  return typeof v === "string" && (VERDICTS as string[]).includes(v);
}

/** Parse "£8,500" style input into a whole number of pounds between £100 and £500,000. */
export function validateEstimate(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = (raw ?? "").replace(/[£,\s]/g, "");
  if (!cleaned) return { ok: false, error: "Enter what you think it's worth" };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "Enter a whole number of pounds" };
  const n = Number(cleaned);
  if (n < ESTIMATE_MIN || n > ESTIMATE_MAX) return { ok: false, error: "Enter a value between £100 and £500,000" };
  return { ok: true, value: n };
}

/** % difference of the user's estimate vs the Valu8 value (positive = user thinks it's worth more). */
export function pctDifference(userEstimate: number | null | undefined, valu8Value: number | null | undefined): number | null {
  if (!userEstimate || !valu8Value || valu8Value <= 0) return null;
  return Math.round(((userEstimate - valu8Value) / valu8Value) * 1000) / 10;
}

export function normaliseFeedback(raw: unknown): ValuationFeedbackState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    verdict: isVerdict(r.verdict) ? r.verdict : null,
    user_estimate: typeof r.user_estimate === "number" ? r.user_estimate : null,
    followup_opt_in: r.followup_opt_in === true,
  };
}
