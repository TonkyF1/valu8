import { useMemo, useState } from "react";
import { Wrench, TrendingUp, RotateCcw, Sparkles, Check } from "lucide-react";
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
  const fixables = useMemo(
    () =>
      insights
        .map((ins, originalIndex) => ({ ins, originalIndex }))
        .filter(
          ({ ins }) =>
            ins.fixable === true &&
            typeof ins.priceImpact === "number" &&
            ins.priceImpact < 0
        )
        // Surface highest ROI first
        .sort((a, b) => {
          const roiA = Math.abs(a.ins.priceImpact ?? 0) - (a.ins.fixCost ?? 0);
          const roiB = Math.abs(b.ins.priceImpact ?? 0) - (b.ins.fixCost ?? 0);
          return roiB - roiA;
        }),
    [insights]
  );

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
  const selectBest = () => {
    // Auto-select items where price impact > fix cost (positive ROI)
    const best = fixables
      .filter((f) => Math.abs(f.ins.priceImpact ?? 0) > (f.ins.fixCost ?? 0))
      .map((f) => f.originalIndex);
    setSelected(new Set(best));
  };

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
  const maxPossibleUpside = fixables.reduce(
    (sum, f) => sum + Math.abs(f.ins.priceImpact ?? 0),
    0
  );
  // For the visual bar
  const barProgress = maxPossibleUpside > 0 ? (upside / maxPossibleUpside) * 100 : 0;

  return (
    <section className="mb-7 animate-fade-in-up">
      <div className="rounded-[20px] overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent shadow-[0_24px_48px_-24px_hsl(176_100%_42%_/_0.18)]">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center">
                <Wrench className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                  What if you fixed these?
                </h2>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/80 mt-0.5">
                  Interactive · {fixables.length} fixable item{fixables.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectBest}
                className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/15"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Best ROI
                </span>
              </button>
              <button
                type="button"
                onClick={allSelected ? reset : selectAll}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/40"
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
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[58ch]">
            Tick the items you'd be willing to fix before listing. We'll show you the realistic upside, your cost to get there, and the new asking price.
          </p>
        </div>

        {/* Visual outcome — before → after bar */}
        <div className="mx-5 sm:mx-6 mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.1] to-primary/[0.02] p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary/90 font-semibold mb-2 relative">
            <Sparkles className="h-3 w-3" /> Projected private sale
          </div>
          <div className="flex items-baseline gap-3 flex-wrap relative">
            <div className="text-[2.5rem] sm:text-5xl font-semibold tabular-nums text-gradient-primary leading-[0.95] tracking-tight">
              £<CountUp value={adjustedPrivateSale} />
            </div>
            {upside > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums font-semibold rounded-full px-2.5 py-1 border text-primary bg-primary/15 border-primary/40">
                <TrendingUp className="h-3 w-3" /> +£{upside.toLocaleString()}
              </span>
            )}
          </div>

          {/* Progress bar — before to projected */}
          <div className="mt-4 relative">
            <div className="flex items-baseline justify-between mb-1.5 text-[10px] tabular-nums">
              <span className="text-muted-foreground">Now <span className="text-foreground/85">£{privateSale.toLocaleString()}</span></span>
              <span className="text-muted-foreground">Max <span className="text-foreground/85">£{(privateSale + maxPossibleUpside).toLocaleString()}</span></span>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_12px_hsl(176_100%_42%_/_0.5)] transition-[width] duration-500 ease-out"
                style={{ width: `${barProgress}%` }}
              />
            </div>
          </div>

          {/* Cost + net summary */}
          {(costToFix > 0 || upside > 0) && (
            <div className="mt-4 pt-4 border-t border-primary/15 grid grid-cols-3 gap-3 text-[11px] relative">
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9.5px] font-medium">Upside</div>
                <div className="tabular-nums font-semibold text-primary mt-0.5">+£{upside.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9.5px] font-medium">Fix cost</div>
                <div className="tabular-nums font-semibold text-foreground/90 mt-0.5">£{costToFix.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-[0.12em] text-[9.5px] font-medium">Net gain</div>
                <div className={cn(
                  "tabular-nums font-semibold mt-0.5 inline-flex items-center gap-1",
                  netGain >= 0 ? "text-primary" : "text-amber-300"
                )}>
                  {netGain >= 0 ? "+" : "−"}£{Math.abs(netGain).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {adjustedAsking != null && upside > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/15 flex items-baseline justify-between gap-3 flex-wrap relative">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-medium">New asking price</span>
              <span className="text-base font-semibold tabular-nums text-foreground">
                £{adjustedAsking.toLocaleString()}
                {negotiationBuffer != null && (
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-normal normal-case tracking-normal">
                    (+£{negotiationBuffer.toLocaleString()} buffer)
                  </span>
                )}
              </span>
            </div>
          )}

          {upside === 0 && (
            <div className="mt-3 text-[11.5px] text-muted-foreground/90 relative">
              Tick items below to see the impact — try <button onClick={selectBest} className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Best ROI</button> for a one-tap selection.
            </div>
          )}
        </div>

        {/* Fixable items — ranked by ROI */}
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Sorted by ROI
            </div>
            {selected.size > 0 && (
              <div className="text-[10px] tabular-nums text-primary/90 font-medium">
                {selected.size} / {fixables.length} selected
              </div>
            )}
          </div>
          <ul className="space-y-2">
            {fixables.map(({ ins, originalIndex }, i) => {
              const checked = selected.has(originalIndex);
              const impact = Math.abs(ins.priceImpact ?? 0);
              const fixCost = ins.fixCost ?? 0;
              const roi = impact - fixCost;
              const goodROI = roi > 0 && impact > fixCost * 1.5;
              return (
                <li key={originalIndex}>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all",
                      checked
                        ? "border-primary/50 bg-primary/[0.08] shadow-[0_0_0_1px_hsl(176_100%_42%_/_0.15)]"
                        : "border-border/50 bg-muted/15 hover:border-border hover:bg-muted/25"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 h-5 w-5 rounded-md border-2 grid place-items-center transition-colors shrink-0",
                      checked ? "bg-primary border-primary" : "border-border bg-background/40",
                    )}>
                      {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(originalIndex)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                            {SLOT_LABELS[ins.slot] ?? "Photo"}
                          </span>
                          {goodROI && i < 2 && (
                            <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-primary bg-primary/10 border border-primary/30 rounded-full px-1.5 py-0.5">
                              ★ High ROI
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] tabular-nums font-semibold text-primary">
                          +£{impact.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[13px] text-foreground/95 leading-snug">
                        {ins.observation}
                      </div>
                      {fixCost > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          Est. fix ~£{fixCost.toLocaleString()}
                          {roi > 0 && (
                            <span className="text-primary/80 ml-1.5">· Net +£{roi.toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="text-[10.5px] text-muted-foreground/70 mt-4 leading-relaxed">
            Estimates only — actual repair costs and buyer reactions vary. Use as a guide for what's worth fixing before listing.
          </p>
        </div>
      </div>
    </section>
  );
}
