/**
 * Car grade shown on the homepage price arc: Poor -> Excellent from real signals only
 * (mileage for age, latest DVSA MOT, photo condition score, MOT mileage drop).
 * Write-off / finance are not checked by any provider, so they never feed the grade.
 */

export const GRADES = [
  { key: "poor", label: "Poor", color: "#FF4D4D" },
  { key: "average", label: "Average", color: "#FF9F1C" },
  { key: "good", label: "Good", color: "#2ED573" },
  { key: "above", label: "Above average", color: "#3B9EFF" },
  { key: "excellent", label: "Excellent", color: "#A55EEA" },
] as const;

export type GradeIndex = 0 | 1 | 2 | 3 | 4;

/** DfT National Travel Survey (NTS0901, England): cars average roughly 7,000 miles a year. */
export const TYPICAL_MILES_PER_YEAR = 7000;

export interface MotEntry { date: string; result: string; advisories?: string[] }
export interface GradeInput {
  mileage?: number | null;
  /** ISO date of first registration, if known. */
  firstRegistered?: string | null;
  year?: number | null;
  motHistory?: MotEntry[] | null;
  /** 1-10 from the photo scan, null/undefined when no photos. */
  conditionScore?: number | null;
  /** DVSA odometer readings show a mileage drop. */
  mileageDrop?: boolean;
  now?: Date;
}

export interface CarGrade { index: GradeIndex; label: string; color: string; points: number }

function ageYears(i: GradeInput): number | null {
  const now = i.now ?? new Date();
  const d = i.firstRegistered ? new Date(i.firstRegistered) : null;
  if (d && !Number.isNaN(d.getTime())) return (now.getTime() - d.getTime()) / (365.25 * 864e5);
  if (i.year && i.year > 1900) return now.getFullYear() - i.year + 0.5;
  return null;
}

export function mileagePoints(i: GradeInput): number {
  const age = ageYears(i);
  if (!i.mileage || i.mileage <= 0 || age == null) return 0;
  const ratio = i.mileage / (TYPICAL_MILES_PER_YEAR * Math.max(1, age));
  if (ratio <= 0.6) return 2;
  if (ratio <= 0.85) return 1;
  if (ratio <= 1.25) return 0;
  if (ratio <= 1.6) return -1;
  return -2;
}

export function motPoints(history?: MotEntry[] | null): number {
  const latest = [...(history ?? [])].filter((e) => e?.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return 0;
  if (!/pass/i.test(latest.result)) return -2;
  const adv = latest.advisories ?? [];
  if (adv.some((a) => /corro|rust|structurally/i.test(a))) return -1;
  if (adv.length === 0) return 1;
  if (adv.length >= 4) return -1;
  return 0;
}

export function photoPoints(score?: number | null): number {
  if (score == null || !Number.isFinite(score)) return 0;
  if (score >= 9) return 2;
  if (score >= 7) return 1;
  if (score >= 5) return 0;
  return -1;
}

export function gradeCar(i: GradeInput): CarGrade {
  const points = mileagePoints(i) + motPoints(i.motHistory) + photoPoints(i.conditionScore);
  let index: GradeIndex = points <= -2 ? 0 : points <= 0 ? 1 : points === 1 ? 2 : points <= 3 ? 3 : 4;
  // Excellent needs top photo scores.
  if (index === 4 && !((i.conditionScore ?? 0) >= 9)) index = 3;
  // A mileage drop on the MOT record caps the grade at Average.
  if (i.mileageDrop && index > 1) index = 1;
  return { index, points, label: GRADES[index].label, color: GRADES[index].color };
}

/** Arc fractions for a grade's fifth of the arc; the end grades run to the very ends. */
export function gradeArc(index: GradeIndex) {
  return { from: index / 5, to: (index + 1) / 5 };
}

/** Pull grade inputs out of a saved valuation report. */
export function gradeFromReport(report: any, extra: { mileage?: number; firstRegistered?: string; year?: number }): CarGrade {
  const checks: any[] = Array.isArray(report?.hpi?.checks) ? report.hpi.checks : [];
  return gradeCar({
    mileage: extra.mileage,
    firstRegistered: extra.firstRegistered,
    year: extra.year,
    motHistory: report?.motSource === "dvsa" ? report?.motHistory : [],
    conditionScore: typeof report?.conditionScore === "number" ? report.conditionScore : null,
    mileageDrop: checks.some((c) => /lower than mot/i.test(String(c?.label ?? ""))),
  });
}
