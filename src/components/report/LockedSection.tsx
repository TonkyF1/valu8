import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Elegant locked panel — placeholders only (no real data blurred underneath).
 * Use when reportPaywallEnabled && !unlocked.
 */
export function LockedSection({
  title,
  blurb = "Included in the £2.99 Full Report",
  rows = 3,
  className,
  ctaHref = "#",
}: {
  title: string;
  blurb?: string;
  rows?: number;
  className?: string;
  /** Scroll target for the checkout CTA (usually the ReportCheckout at top). */
  ctaHref?: string;
}) {
  return (
    <section
      aria-label={`${title} — locked`}
      className={cn(
        "relative mb-4 overflow-hidden rounded-2xl border border-border/70 bg-card",
        className,
      )}
      style={{ background: "var(--gradient-card, #171717)" }}
    >
      <div className="pointer-events-none select-none space-y-2.5 p-5 opacity-40" aria-hidden>
        <div className="h-3 w-32 rounded bg-muted/80" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-muted/50" style={{ width: `${88 - i * 8}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
        <div className="mx-4 max-w-sm rounded-2xl border border-primary/25 bg-[#111111]/95 px-5 py-4 text-center shadow-lg">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Full Report
          </p>
          <h3 className="mt-1.5 text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
          <a
            href={ctaHref}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold transition hover:brightness-110"
            style={{ background: "#00D6C8", color: "#111111" }}
          >
            Unlock for £2.99
          </a>
        </div>
      </div>
    </section>
  );
}
