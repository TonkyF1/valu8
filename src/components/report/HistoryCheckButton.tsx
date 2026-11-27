import { ArrowUpRight } from "lucide-react";
import { ev } from "@/lib/analytics";

/** Official affiliate link format from carVertical. Plain link: no redirect, wrapper, masking, shortener or iframe. */
export const HISTORY_CHECK_URL = "https://www.carvertical.deal/4BZC6ZM/5DKLH2/?uid=22&source_id=AFF&sub1=valu8";

/** Where on Valu8 a history-check link sits. Sent to carVertical as sub2 and logged (anonymously) on click. */
export type HistoryPlacement =
  | "report" | "report_premium" | "report_free" | "shared" | "home_result" | "home_result_buying" | "home"
  | "value_model" | "value_year" | "guide" | "faq" | "check" | "history_page" | "history_page_form" | "email";

/** Clean placement tag: lower-case letters, digits and underscores only. */
const cleanPlacement = (p?: string | null) => (p ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);

/**
 * Affiliate link, plus the placement as sub2 (when given) and the viewed car's reg (uppercased, whitespace
 * stripped, URL-encoded) as sub3. No reg: no sub3. No placement: no sub2.
 */
export function historyCheckHref(registration?: string | null, placement?: string | null): string {
  const reg = (registration ?? "").toUpperCase().replace(/\s+/g, "");
  const p = cleanPlacement(placement);
  return `${HISTORY_CHECK_URL}${p ? `&sub2=${p}` : ""}${reg ? `&sub3=${encodeURIComponent(reg)}` : ""}`;
}

/** Anonymous, cookieless click log (site_events, no reg sent). Never blocks the link. */
export function trackHistoryClick(placement?: string | null) {
  try { ev("history_check_click", { placement: cleanPlacement(placement) || "unknown" }); } catch { /* ignore */ }
}
export const HISTORY_CHECK_DISCLOSURE = "Affiliate link: Valu8 earns a commission if you buy.";
/** carVertical confirmed (27 Nov 2026) we may show this code; it is also applied automatically through the tracking link. */
export const HISTORY_CHECK_COUPON = "valu8";
export const HISTORY_CHECK_COUPON_LINE = `Code ${HISTORY_CHECK_COUPON} is applied automatically.`;
/** carVertical's own logo (as supplied by carVertical), served from /public. */
export const CARVERTICAL_LOGO = "/partners/carvertical.svg";

const DEFAULT_TITLE = "Want the full history behind this car?";
const DEFAULT_BODY = "A paid history check can show things MOT records don't, such as outstanding finance, write-off categories, theft records and mileage rollbacks.";
export const HISTORY_TITLE_BUYING = "Buying this car? Check its history first.";

type Props = {
  registration?: string | null;
  placement?: HistoryPlacement;
  /** "card" (default): full block. "line": one slim row for pages where it is a side note (homepage, FAQ). */
  variant?: "card" | "line";
  title?: string;
  body?: string;
  className?: string;
};

function Logo({ h = 16 }: { h?: number }) {
  return <img src={CARVERTICAL_LOGO} alt="carVertical" width={Math.round(h * 7.2)} height={h} style={{ height: h, width: "auto" }} loading="lazy" decoding="async" />;
}

/** carVertical "Full vehicle history check": logo, plain sponsored link (reg as sub3 when known), coupon note and the affiliate disclosure. */
export function HistoryCheckButton({ registration, placement, variant = "card", title = DEFAULT_TITLE, body = DEFAULT_BODY, className = "" }: Props = {}) {
  const href = historyCheckHref(registration, placement);
  const onClick = () => trackHistoryClick(placement);
  if (variant === "line") {
    return (
      <aside className={`mx-auto max-w-3xl px-4 ${className}`} data-testid="history-check" data-variant="line" aria-label="Vehicle history check">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <Logo h={14} />
            <p className="text-sm text-muted-foreground">Buying? Check finance, write-offs and mileage first. <a href="/car-history-check" className="underline underline-offset-4 hover:text-foreground">What it covers</a></p>
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <a href={href} target="_blank" rel="sponsored noopener" onClick={onClick} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-4">
              Full vehicle history check <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
            <p className="text-[11px] text-muted-foreground/80" data-testid="history-check-disclosure">{HISTORY_CHECK_COUPON_LINE} {HISTORY_CHECK_DISCLOSURE}</p>
          </div>
        </div>
      </aside>
    );
  }
  return (
    <section className={`mt-6 rounded-2xl border border-white/[0.08] bg-[#151515] p-5 sm:p-6 ${className}`} data-testid="history-check" data-variant="card" aria-label="Vehicle history check">
      <Logo h={16} />
      <p className="mt-4 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F7F5F3] px-5 text-sm font-semibold text-[#111] transition-colors hover:bg-white sm:w-auto sm:inline-flex"
      >
        Full vehicle history check <span className="hidden font-normal text-[#111]/60 sm:inline">via carVertical</span>
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </a>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="text-foreground/90">{HISTORY_CHECK_COUPON_LINE}</span>{" "}
        <span data-testid="history-check-disclosure">{HISTORY_CHECK_DISCLOSURE}</span>
      </p>
    </section>
  );
}
