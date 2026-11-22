import type React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, type PriceMover } from "@/lib/priceMovers";

/** "What moved your price": the real reasons, biggest first. Free and Premium. */
export function PriceMovers({ movers, className, compact = false, id, more }: { movers: PriceMover[]; className?: string; compact?: boolean; id?: string; more?: React.ReactNode }) {
  if (!movers.length) return null;
  const list = compact ? movers.slice(0, 4) : movers;
  return (
    <section id={id} aria-labelledby="movers-h" data-testid="price-movers" className={cn("rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-4 sm:px-5", className)}>
      <h2 id="movers-h" className="text-[15px] font-semibold tracking-tight text-white">What moved your price</h2>
      <ul className="mt-2 divide-y divide-white/[0.07]">
        {list.map((m) => (
          <li key={m.key} className="flex gap-3 py-3" data-testid={`mover-${m.key}`}>
            <span aria-hidden className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
              m.tone === "down" ? "bg-amber-400/10 text-amber-300" : m.tone === "up" ? "bg-primary/10 text-primary" : "bg-white/[0.06] text-[#A8A8A8]")}>
              {m.tone === "down" ? <ArrowDownRight className="h-3.5 w-3.5" /> : m.tone === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm font-medium", m.key === "mot-expired" ? "text-amber-200" : "text-[#EDEDED]")}>{m.label}</p>
                {m.pct != null && (
                  <span className={cn("shrink-0 text-sm font-semibold tabular-nums", m.pct < 0 ? "text-amber-300" : "text-primary")}
                    aria-label={`${m.pct < 0 ? "minus" : "plus"} ${Math.abs(m.pct)} percent`}>{fmtPct(m.pct)}</span>
                )}
              </div>
              {!compact && <p className="mt-0.5 text-[13px] leading-[1.5] text-[#B4B4B4]">{m.detail}</p>}
              {compact && m.key === "mot-expired" && <p className="mt-0.5 text-[13px] leading-[1.5] text-[#B4B4B4]">{m.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
      {more && <div className="pt-1 text-[13px]">{more}</div>}
    </section>
  );
}
