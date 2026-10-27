import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MotEntry } from "@/lib/valuation";
import { groupMotByYear, motYearSummary } from "@/lib/motGroups";

const safeFormat = (d: string) => {
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? format(t, "d MMM yyyy") : d;
};

export function MotTestItem({ m, first }: { m: MotEntry; first?: boolean }) {
  return (
    <li className={cn(!first && "pt-3 border-t border-border/40")}>
      <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className={cn("text-xs font-semibold ", m.result === "Fail" ? "text-destructive" : "text-primary")}>
            {m.result === "Fail" ? "Fail" : "Pass"}
          </span>
          <span className="font-medium text-sm">{safeFormat(m.date)}</span>
          {m.expiryDate && m.result !== "Fail" && (
            <span className="text-[11px] text-muted-foreground">
              · Expires {new Date(m.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
            </span>
          )}
        </div>
        {m.mileage > 0 && <span className="text-xs text-muted-foreground tabular-nums">{m.mileage.toLocaleString()} mi</span>}
      </div>
      {(m.failures?.length ?? 0) > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {m.failures!.map((f, k) => (
            <li key={k} className="text-xs text-foreground/85 leading-snug">
              <span className={cn("font-semibold uppercase tracking-wider mr-1.5", m.result === "Fail" ? "text-destructive" : "text-muted-foreground")}>
                {m.result === "Fail" ? "Fail" : "Rectified"}
              </span>
              {f}
            </li>
          ))}
        </ul>
      )}
      {(m.advisories?.length ?? 0) > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {m.advisories!.map((a, k) => (
            <li key={k} className="text-xs text-foreground/85 leading-snug">
              <span className="font-semibold uppercase tracking-wider text-amber-400 mr-1.5">Advisory</span>
              {a}
            </li>
          ))}
        </ul>
      )}
      {(!m.advisories || m.advisories.length === 0) && (!m.failures || m.failures.length === 0) && m.note && (
        <div className="text-xs text-muted-foreground mt-1">{m.note}</div>
      )}
    </li>
  );
}

/** MOT tests grouped by calendar year; newest year open, older years collapsed. */
export function MotHistoryByYear({ history, idPrefix = "mot" }: { history: MotEntry[]; idPrefix?: string }) {
  const groups = groupMotByYear(history);
  const [open, setOpen] = useState<Set<number>>(() => new Set(groups.length ? [groups[0].year] : []));
  const toggle = (y: number) =>
    setOpen(prev => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });

  return (
    <div className="space-y-2" data-testid="mot-by-year">
      {groups.map(g => {
        const isOpen = open.has(g.year);
        const panelId = `${idPrefix}-year-${g.year}`;
        const hasFail = g.tests.some(m => m.result === "Fail");
        return (
          <div key={g.year} className={cn("rounded-xl border transition-colors", isOpen ? "border-border/60 bg-background/30" : "border-border/40 bg-muted/10")}>
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(g.year)}
                className="w-full min-h-[44px] flex items-center gap-2 px-3 sm:px-4 py-2.5 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", hasFail ? "bg-destructive" : "bg-primary")} aria-hidden />
                <span className="flex-1 min-w-0 text-[13px] font-medium leading-snug text-foreground/90">{motYearSummary(g)}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
            </h3>
            <div id={panelId} role="region" aria-label={`MOT tests ${g.year}`} hidden={!isOpen} className="px-3 sm:px-4 pb-3">
              {isOpen && (
                <ol className="space-y-3 pt-1">
                  {g.tests.map((m, i) => (
                    <MotTestItem key={`${m.date}-${i}`} m={m} first={i === 0} />
                  ))}
                </ol>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
