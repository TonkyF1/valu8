import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { gbp } from "@/data/valuePages";

/**
 * Presentation-only building blocks for the /value model pages. None of these add or change page copy:
 * every figure comes from the same price data as the tables, and anything purely decorative (chart labels,
 * "View table") is marked data-decor so it is excluded from the copy-diff check.
 */

export const CARD = "rounded-2xl border border-border bg-card/60 p-5 md:p-7";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${CARD} ${className}`}>{children}</section>;
}

/** Native <details>: collapsed content stays in the DOM (and the prerender), so crawlers still read it. */
export function Disclosure({ summary, children, open, chrome, className = "" }: { summary: ReactNode; children: ReactNode; open?: boolean; chrome?: boolean; className?: string }) {
  return (
    <details open={open} className={`group ${className}`}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden" {...(chrome ? { "data-decor": "" } : {})}>
        <span className="min-w-0">{summary}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

/** Only the headline figure (accent) is teal; supporting figures are white so the eye goes to one number. */
export function StatTile({ label, value, wide, accent }: { label: string; value: string; wide?: boolean; accent?: boolean }) {
  return (
    <div className={`${wide ? "col-span-2" : ""} rounded-xl border border-border bg-background/60 px-4 py-3`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl md:text-2xl font-semibold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

type Row = { label: string; value: number; sub?: string };

/** Horizontal bars (chart is decorative: the table beside it carries the same numbers as text). */
export function HBars({ rows, ariaLabel }: { rows: Row[]; ariaLabel: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    // role="img" makes this one image to assistive tech, so it must not be a list (axe: list children of an img).
    <div className="space-y-3" role="img" aria-label={ariaLabel} data-decor="">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground/85">{r.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{gbp(r.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/60">
            <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${Math.max((r.value / max) * 100, 3)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type YearPoint = { year: number; median: number; low: number; high: number };

/** Value-by-year column chart with the typical range as a faint column behind each median. */
export function YearChart({ years, ariaLabel }: { years: YearPoint[]; ariaLabel: string }) {
  const ys = [...years].sort((a, b) => a.year - b.year);
  const max = Math.max(...ys.map((y) => y.high), 1);
  const peak = ys.reduce((a, b) => (b.median > a.median ? b : a));
  const last = ys[ys.length - 1];
  const show = new Set([ys[0].year, peak.year, ...(last.median !== peak.median ? [last.year] : [])]);
  const H = 160;
  return (
    <div role="img" aria-label={ariaLabel} data-decor="" className="select-none">
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: H + 22 }}>
        {ys.map((y) => (
          <div key={y.year} className="relative flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`${y.year}: ${gbp(y.median)} (${gbp(y.low)} – ${gbp(y.high)})`}>
            {show.has(y.year) && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-primary" style={{ bottom: (y.high / max) * H + 24 }}>{gbp(y.median)}</span>}
            <div className="relative w-full" style={{ height: H }}>
              <div className="absolute bottom-0 w-full rounded-t-md bg-primary/15" style={{ height: (y.high / max) * H }} />
              <div className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary" style={{ height: (y.median / max) * H }} />
            </div>
            <span className="mt-1.5 h-4 text-xs tabular-nums text-muted-foreground">{String(y.year).slice(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
