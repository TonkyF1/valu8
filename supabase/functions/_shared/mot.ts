// MOT expiry helpers shared by edge functions and the frontend.
// Accepts ISO (YYYY-MM-DD, optionally with time), DVSA "YYYY.MM.DD" and UK "DD/MM/YYYY".

export function parseMotDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  let y: number, mo: number, d: number;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else {
    m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (!m) return null;
    y = +m[1]; mo = +m[2]; d = +m[3];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 ? date : null;
}

/** Whole calendar days from `now` (UK calendar date) until expiry. Negative = expired. */
export function motDaysRemaining(expiry: string | null | undefined, now: Date = new Date()): number | null {
  const e = parseMotDate(expiry);
  if (!e) return null;
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const today = parseMotDate(ymd)!;
  return Math.round((e.getTime() - today.getTime()) / 86400000);
}

export type MotStatusKind = "expired" | "due_soon" | "ok" | "long" | "unknown";

/** due_soon < 60 days; long >= 270 days (~9 months). */
export function motStatus(expiry: string | null | undefined, now: Date = new Date()): { kind: MotStatusKind; days: number | null; label: string } {
  const days = motDaysRemaining(expiry, now);
  if (days == null) return { kind: "unknown", days, label: "MOT status unknown" };
  if (days < 0) return { kind: "expired", days, label: `MOT expired ${-days} day${days === -1 ? "" : "s"} ago` };
  if (days < 60) return { kind: "due_soon", days, label: days === 0 ? "MOT expires today" : `MOT expires in ${days} day${days === 1 ? "" : "s"}` };
  if (days >= 270) return { kind: "long", days, label: `Long MOT (${Math.round(days / 30.4)} months left)` };
  return { kind: "ok", days, label: `MOT valid for ${Math.round(days / 30.4)} more months` };
}

/** Price adjustment for MOT expiry; null when none applies. */
export function motAdjustment(expiry: string | null | undefined, now: Date = new Date()): { mult: number; label: string; impactPct: number } | null {
  const s = motStatus(expiry, now);
  if (s.kind === "expired") return { mult: 0.95, label: "MOT expired", impactPct: -5 };
  if (s.kind === "due_soon") return { mult: 0.98, label: "MOT due within 2 months", impactPct: -2 };
  return null;
}

const LONG_MOT_RE = /\b(?:a\s+)?(?:long|lengthy|fresh|full|generous|plenty of)\s+(?:\w+\s+){0,2}MOT\b/gi;

/** Removes "long MOT"-style claims from AI text when the MOT isn't actually long. */
export function sanitizeMotClaim(text: string, expiry: string | null | undefined, now: Date = new Date()): string {
  if (!text) return text;
  const s = motStatus(expiry, now);
  if (s.kind === "long" || s.kind === "unknown") return text;
  return text.replace(LONG_MOT_RE, (m) => (/^a\s/i.test(m) ? "an MOT" : "MOT"));
}

/** True when a bullet is purely a "long MOT" selling point that no longer applies. */
export function isFalseLongMotClaim(text: string, expiry: string | null | undefined, now: Date = new Date()): boolean {
  const s = motStatus(expiry, now);
  if (s.kind === "long" || s.kind === "unknown") return false;
  LONG_MOT_RE.lastIndex = 0;
  return LONG_MOT_RE.test(text);
}

const CLEAN_PASS_RE = /\b(clean|passed|pass|zero advisor|no advisor|advisory[- ]free|flawless)\b.*\bMOT\b|\bMOT\b.*\b(clean|pass(?:ed)?|zero advisor|no advisor|advisory[- ]free)\b/i;

function fmtExpiry(expiry: string): string {
  const d = parseMotDate(expiry);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "soon";
}

/**
 * A "clean pass" strength next to an MOT that expires within ~2 months (or has
 * expired) reads as contradictory. Reword it so the expiry is stated alongside
 * the pass. Other bullets are untouched.
 */
export function motConsistentBullets(items: string[] | undefined, expiry: string | null | undefined, now: Date = new Date()): string[] | undefined {
  if (!Array.isArray(items) || !expiry) return items;
  const days = motDaysRemaining(expiry, now);
  if (days == null || days > 62) return items;
  let done = false;
  return items.flatMap((t) => {
    if (typeof t !== "string" || !CLEAN_PASS_RE.test(t)) return [t];
    if (done) return []; // one consistent MOT bullet is enough
    done = true;
    return [days < 0
      ? `Last MOT passed cleanly, but it expired on ${fmtExpiry(expiry)} — re-test before selling`
      : `Passed its last MOT cleanly, but it expires on ${fmtExpiry(expiry)} — renew before selling for the best price`];
  });
}

type MotEntryLite = { date?: string; result?: string; expiryDate?: string | null };

/** Expiry of the most recent PASS (a failed test carries no expiry). */
export function currentMotExpiry(entries: MotEntryLite[]): string | undefined {
  return entries.find((e) => e.expiryDate)?.expiryDate ?? undefined;
}

/** Latest DVSA test is a fail with no pass after it and no MOT left: car can't legally be driven. */
export function failedWithoutValidMot(entries: MotEntryLite[], now: Date = new Date()): boolean {
  if (entries[0]?.result !== "Fail") return false;
  const days = motDaysRemaining(currentMotExpiry(entries), now);
  return days == null || days < 0;
}
