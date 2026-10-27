import type { MotEntry } from "@/lib/valuation";

export interface MotYearGroup {
  year: number;
  /** Tests in that calendar year, newest first. */
  tests: MotEntry[];
}

const ts = (d: string) => {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Calendar year of a test date (UTC, so a midnight ISO date never slips a year). */
export function motYear(date: string): number {
  const t = new Date(date);
  if (Number.isFinite(t.getTime())) return t.getUTCFullYear();
  const m = /(\d{4})/.exec(date ?? "");
  return m ? Number(m[1]) : 0;
}

/** Group MOT tests by calendar year of the test date, newest year first, newest test first. */
export function groupMotByYear(history: MotEntry[] | undefined | null): MotYearGroup[] {
  const byYear = new Map<number, MotEntry[]>();
  for (const m of history ?? []) {
    const y = motYear(m.date);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(m);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, tests]) => ({ year, tests: [...tests].sort((a, b) => ts(b.date) - ts(a.date)) }));
}

const outcome = (m: MotEntry) => (m.result === "Fail" ? "Fail" : "Pass");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * One-line summary for a year header, e.g.
 * "2023 · Pass · 84,210 miles · 2 advisories" or
 * "2022 · 2 tests: Fail, then Pass · 76,002 miles · 1 failure · 3 advisories".
 */
export function motYearSummary(g: MotYearGroup): string {
  const parts: string[] = [String(g.year || "Unknown year")];
  if (g.tests.length === 1) {
    parts.push(outcome(g.tests[0]));
  } else {
    // Chronological order reads naturally: "Fail, then Pass".
    const seq = [...g.tests].reverse().map(outcome);
    parts.push(`${g.tests.length} tests: ${seq.join(", then ")}`);
  }
  const miles = Math.max(0, ...g.tests.map(m => m.mileage || 0));
  if (miles > 0) parts.push(`${miles.toLocaleString("en-GB")} miles`);
  const failures = g.tests.reduce((n, m) => n + (m.result === "Fail" ? m.failures?.length ?? 0 : 0), 0);
  if (failures > 0) parts.push(plural(failures, "failure"));
  const advisories = g.tests.reduce((n, m) => n + (m.advisories?.length ?? 0), 0);
  parts.push(advisories > 0 ? plural(advisories, "advisory").replace("advisorys", "advisories") : "no advisories");
  return parts.join(" · ");
}
