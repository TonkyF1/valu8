/** Share, MOT reminder and value-trend helpers (no backend needed). */

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareLink(
  url: string,
  title: string,
  text?: string,
  nav: Partial<Navigator> = typeof navigator !== "undefined" ? navigator : {},
): Promise<ShareResult> {
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title, text, url });
      return "shared";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "cancelled";
      // fall through to copy
    }
  }
  try {
    await nav.clipboard!.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export interface MotDue { date: Date; daysLeft: number; status: "overdue" | "soon" | "upcoming" }

/** MOT status for a stored mot_expiry (YYYY-MM-DD or ISO). Only "soon" (≤60 days) and "overdue" warrant a reminder. */
export function motDue(motExpiry: string | null | undefined, now: Date = new Date()): MotDue | null {
  if (!motExpiry) return null;
  const d = new Date(motExpiry.length === 10 ? `${motExpiry}T00:00:00` : motExpiry);
  if (isNaN(d.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysLeft = Math.round((day.getTime() - today.getTime()) / 86400000);
  const status = daysLeft < 0 ? "overdue" : daysLeft <= 60 ? "soon" : "upcoming";
  return { date: day, daysLeft, status };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** All-day iCalendar event with a reminder 14 days before. */
export function buildMotIcs(opts: { vehicle: string; registration?: string | null; motDate: Date; url: string; now?: Date }): string {
  const { vehicle, registration, motDate, url } = opts;
  const now = opts.now ?? new Date();
  const end = new Date(motDate); end.setDate(end.getDate() + 1);
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const label = registration ? `${vehicle} (${registration.toUpperCase()})` : vehicle;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Valu8//MOT reminder//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:mot-${ymd(motDate)}-${(registration || vehicle).replace(/[^A-Za-z0-9]/g, "")}@valu8.uk`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(motDate)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(`MOT due: ${label}`)}`,
    `DESCRIPTION:${esc(`MOT expires today. Book your MOT and revalue your car on Valu8: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:-P14D", "ACTION:DISPLAY", `DESCRIPTION:${esc(`MOT due in 14 days: ${label}`)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface TrendRow { id: string; registration?: string | null; private_value: number | null; created_at: string; report?: { valuationUnavailable?: boolean } | null }
export interface Trend { change: number; pct: number; previousValue: number; previousDate: string; count: number }

const normReg = (r?: string | null) => (r || "").replace(/\s+/g, "").toUpperCase();

/** For each row, the change versus the previous valuation of the same registration. */
export function valueTrends(rows: TrendRow[]): Record<string, Trend> {
  const groups = new Map<string, TrendRow[]>();
  for (const r of rows) {
    const reg = normReg(r.registration);
    if (!reg || !r.private_value || r.report?.valuationUnavailable) continue;
    (groups.get(reg) ?? groups.set(reg, []).get(reg)!).push(r);
  }
  const out: Record<string, Trend> = {};
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      const change = cur.private_value! - prev.private_value!;
      out[cur.id] = { change, pct: Math.round((change / prev.private_value!) * 1000) / 10, previousValue: prev.private_value!, previousDate: prev.created_at, count: list.length };
    }
  }
  return out;
}
