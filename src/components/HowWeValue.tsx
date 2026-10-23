import { ExternalLink } from "lucide-react";
import type { ValuationExplanation } from "@/lib/valuationExplainer";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export function HowWeValue({ ex }: { ex: ValuationExplanation }) {
  return (
    <div className="space-y-5 text-sm">
      <ol className="space-y-3">
        {ex.steps.map((s) => (
          <li key={s.title}>
            <h3 className="font-medium text-foreground">{s.title}</h3>
            <p className="text-muted-foreground leading-relaxed mt-0.5">{s.body}</p>
          </li>
        ))}
      </ol>

      {ex.comps.length > 0 && (
        <div>
          <h3 className="font-medium text-foreground mb-2">Example comparables</h3>
          <ul className="space-y-2">
            {ex.comps.map((c, i) => (
              <li key={i} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-medium">
                    {c.year} · {c.mileage.toLocaleString("en-GB")} mi{c.trim ? ` · ${c.trim}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {gbp(c.price)} <span className="text-muted-foreground" aria-hidden>→</span>
                    <span className="sr-only"> adjusted to </span> <strong>{gbp(c.adjustedPrice)}</strong>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.why}
                  {c.correctionPct !== 0 && <> ({c.correctionPct > 0 ? "+" : ""}{c.correctionPct}% correction)</>}
                  {c.location ? ` · ${c.location}` : ""}
                </p>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-primary mt-1 min-h-[44px] sm:min-h-0">
                    View listing <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2">Asking prices on dealer forecourts, before our conversion to private-sale value.</p>
        </div>
      )}

      {ex.adjustments.length > 0 && (
        <div>
          <h3 className="font-medium text-foreground mb-2">Adjustments for your car</h3>
          <ul className="space-y-1.5">
            {ex.adjustments.map((a) => (
              <li key={a.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {a.label}
                  {a.scope === "anchor" && <span className="block text-xs">Already in the anchor — shown for transparency</span>}
                  {a.scope === "private" && <span className="block text-xs">Private &amp; part-exchange only</span>}
                </span>
                <span className={a.impactPct < 0 ? "text-destructive tabular-nums" : "text-primary tabular-nums"}>
                  {a.impactPct > 0 ? "+" : ""}{a.impactPct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
