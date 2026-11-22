import type React from "react";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, type PriceMover } from "@/lib/priceMovers";

/**
 * "What moved your price": the real reasons, biggest first. Free and Premium.
 * compact: top 4, detail only for an expired MOT. expandable: every row, tap a row for its detail.
 */
export function PriceMovers({ movers, className, compact = false, expandable = false, id, more }: { movers: PriceMover[]; className?: string; compact?: boolean; expandable?: boolean; id?: string; more?: React.ReactNode }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(["mot-expired"]));
  const [all, setAll] = useState(false);
  if (!movers.length) return null;
  const EXPANDABLE_FIRST = 5;
  const list = compact ? movers.slice(0, 4) : expandable && !all ? movers.slice(0, EXPANDABLE_FIRST) : movers;
  const hidden = expandable && !all ? movers.length - list.length : 0;
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <section id={id} aria-labelledby="movers-h" data-testid="price-movers" className={cn("rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-4 sm:px-5", className)}>
      <h2 id="movers-h" className="text-[15px] font-semibold tracking-tight text-white">What moved your price</h2>
      <ul className="mt-2 divide-y divide-white/[0.07]">
        {list.map((m) => {
          const showDetail = expandable ? open.has(m.key) : !compact || m.key === "mot-expired";
          const head = (
            <>
              <span aria-hidden className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                m.tone === "down" ? "bg-amber-400/10 text-amber-300" : m.tone === "up" ? "bg-primary/10 text-primary" : "bg-white/[0.06] text-[#A8A8A8]")}>
                {m.tone === "down" ? <ArrowDownRight className="h-3.5 w-3.5" /> : m.tone === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn("text-sm font-medium", m.key === "mot-expired" ? "text-amber-200" : "text-[#EDEDED]")}>{m.label}</span>
                {m.pct != null && (
                  <span className={cn("shrink-0 text-sm font-semibold tabular-nums", m.pct < 0 ? "text-amber-300" : "text-primary")}
                    aria-label={`${m.pct < 0 ? "minus" : "plus"} ${Math.abs(m.pct)} percent`}>{fmtPct(m.pct)}</span>
                )}
              </span>
              {!expandable && showDetail && <span className="mt-0.5 block text-[13px] leading-[1.5] text-[#B4B4B4]">{m.detail}</span>}
              </span>
              {expandable && <ChevronDown aria-hidden className={cn("mt-1 h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform", showDetail && "rotate-180")} />}
            </>
          );
          return (
            <li key={m.key} className={expandable ? "py-1" : "flex gap-3 py-3"} data-testid={`mover-${m.key}`}>
              {expandable ? (
                <>
                  <button type="button" onClick={() => toggle(m.key)} aria-expanded={showDetail} className="flex w-full gap-3 py-2 text-left min-h-[44px] items-start">{head}</button>
                  {showDetail && <p className="pl-9 pb-2 text-[13px] leading-[1.5] text-[#B4B4B4]">{m.detail}</p>}
                </>
              ) : head}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="mt-1 min-h-[40px] text-[13px] font-medium text-[#5EF2E6] hover:underline">
          Show {hidden} more reason{hidden === 1 ? "" : "s"}
        </button>
      )}
      {more && <div className="pt-1 text-[13px]">{more}</div>}
    </section>
  );
}
