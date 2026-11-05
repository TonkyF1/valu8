// Visible condition is photo-backed only. Without photos the AI still emits a
// conditionScore (often ~4–7) — that is a guess, not an observation. Never use
// it for Expert Insight copy, price adjustments, or the reported score.

/** Clamp an AI condition score when photos exist; otherwise null (no score). */
export function photoConditionScore(aiScore: unknown, photoCount: number): number | null {
  if (!(photoCount > 0)) return null;
  const s = Number(aiScore);
  if (!Number.isFinite(s)) return null;
  return Math.round(Math.max(1, Math.min(10, s)) * 10) / 10;
}

/** Neutral score for any numeric pricing path that still expects a number. */
export function neutralConditionScore(): number {
  return 7;
}

/** Expert Insight "condition" trigger + photo-mentioning reason. Never when no photos. */
export function expertInsightFromCondition(opts: {
  photoCount: number;
  conditionScore: number | null;
  marketSampleLabel?: string;
}): { majorConditionIssue: boolean; reason: string } {
  const score = opts.conditionScore;
  const major = opts.photoCount > 0 && score != null && score < 6;
  if (!major) return { majorConditionIssue: false, reason: "" };
  const sample = opts.marketSampleLabel ?? "live";
  return {
    majorConditionIssue: true,
    reason: `Condition signals from your photos (${score!.toFixed(1)}/10) materially affect this car's value, so we've adjusted away from the headline market figure of ${sample} comparable UK listings.`,
  };
}
