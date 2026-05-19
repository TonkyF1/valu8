import { useMemo, useState } from "react";
import { Wrench, TrendingUp, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";
import type { PhotoInsight } from "@/lib/valuation";

const SLOT_LABELS: Record<string, string> = {
  front: "Front",
  rear: "Rear",
  side: "Side",
  interior: "Interior",
  odometer: "Odometer",
  engine: "Engine bay",
  other: "Photo",
};

interface Props {
  insights: PhotoInsight[];
  privateSale: number;
  recommendedAskingPrice?: number;
  negotiationBuffer?: number;
}

export function WhatIfSimulator({
  insights,
  privateSale,
  recommendedAskingPrice,
  negotiationBuffer,
}: Props) {
  // Only fixable items with a negative price impact create upside.
  const fixables = useMemo(
    () =>
      insights
        .map((ins, originalIndex) => ({ ins, originalIndex }))
        .filter(
          ({ ins }) =>
            ins.fixable === true &&
            typeof ins.priceImpact === "number" &&
            ins.priceImpact < 0
        ),
    [insights]
  );

  // Track selection by original index for stability
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (fixables.length === 0) return null;

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(fixables.map((f) => f.originalIndex)));
  const reset = () => setSelected(new Set());

  const upside = fixables
    .filter((f) => selected.has(f.originalIndex))
    .reduce((sum, f) => sum + Math.abs(f.ins.priceImpact ?? 0), 0);
  const costToFix = fixables
    .filter((f) => selected.has(f.originalIndex))
    .reduce((sum, f) => sum + (f.ins.fixCost ?? 0), 0);
  const netGain = upside - costToFix;

  const adjustedPrivateSale = privateSale + upside;
  const adjustedAsking =
    recommendedAskingPrice != null
      ? recommendedAskingPrice + upside
      : undefined;

  const allSelected = selected.size === fixables.length;

  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            What if you fixed these?
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={allSelected ? reset : selectAll}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/40"
          >
            {allSelected ? (
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Reset
              </span>
            ) : (
              "Select all"
            )}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Tick the issues you'd be willing to fix before listing. We'll show
          you the price you could realistically ask afterwards.
        </p>

        <ul className="space-y-2 mb-5">
          {fixables.map(({ ins, originalIndex }) => {
            const checked = selected.has(originalIndex);
            const impact = Math.abs(ins.priceImpact ?? 0);
            return (
              <li key={originalIndex}>
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                    checked
                      ? "border-primary/50 bg-primary/[0.06]"
                      : "border-border/50 bg-muted/20 hover:border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(originalIndex)}
                    className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {SLOT_LABELS[ins.slot] ?? "Photo"}
                      </span>
                      <span className="text-[11px] tabular-nums font-medium text-primary">
                        +£{impact.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/90 leading-snug mt-0.5">
                      {ins.observation}
                    </div>
                    {ins.fixCost != null && ins.fixCost > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Est. cost to fix ~£{ins.fixCost.toLocaleString()}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>

        {/* Outcome */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.05] px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary/90 font-medium mb-2">
            <Sparkles className="h-3 w-3" /> Projected private sale
          </div>
          <div className="text-3xl sm:text-[2.25rem] font-semibold tabular-nums text-foreground leading-none">
            £<CountUp value={adjustedPrivateSale} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
            {upside > 0 ? (
              <>
                Up from £{privateSale.toLocaleString()} — that's{" "}
                <span className="text-primary font-medium">
                  +£{upside.toLocaleString()}
                </span>{" "}
                in value unlocked
              </>
            ) : (
              <>Tick items above to see the impact on your price</>
            )}
          </div>

          {adjustedAsking != null && upside > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/15 flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                Suggested asking price
              </span>
              <span className="text-base font-medium tabular-nums text-foreground/90">
                £{adjustedAsking.toLocaleString()}
                {negotiationBuffer != null && (
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                    (+£{negotiationBuffer.toLocaleString()} negotiating room)
                  </span>
                )}
              </span>
            </div>
          )}

          {costToFix > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/15 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-muted-foreground">Cost to fix</div>
                <div className="tabular-nums font-medium text-foreground/90 mt-0.5">
                  £{costToFix.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Net gain</div>
                <div
                  className={cn(
                    "tabular-nums font-medium mt-0.5 inline-flex items-center gap-1",
                    netGain >= 0 ? "text-primary" : "text-amber-300"
                  )}
                >
                  <TrendingUp className="h-3 w-3" />
                  {netGain >= 0 ? "+" : "−"}£
                  {Math.abs(netGain).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          Estimates only — actual repair costs and buyer reactions vary. Use as
          a guide when deciding what's worth fixing before listing.
        </p>
      </div>
    </section>
  );
}
