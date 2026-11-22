import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfidenceTier = "High" | "Medium" | "Low" | "Very Low";

/** The server's confidence, shown as stored. "Very Low" stays "Very low": we don't round it up. */
export function confidenceTier(raw: unknown): ConfidenceTier | null {
  return raw === "High" || raw === "Medium" || raw === "Low" || raw === "Very Low" ? raw : null;
}
export const tierText = (t: ConfidenceTier) => (t === "Very Low" ? "Very low" : t);
export const isLowTier = (t: ConfidenceTier | null) => t === "Low" || t === "Very Low";

/** Confidence level and the data behind it (free and Premium, as promised on the homepage, /pricing and the FAQ). */
export function ConfidenceCard({ tier, reason, sources, checksReason, className }: {
  tier: ConfidenceTier; reason?: string | null; sources?: string[] | null; checksReason?: string | null; className?: string;
}) {
  return (
    <section aria-labelledby="conf-h" data-testid="confidence-card" className={cn("rounded-2xl border border-white/10 bg-[#0d0d0d] px-4 py-4 sm:px-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="conf-h" className="text-[15px] font-semibold tracking-tight text-white">How sure we are</h2>
        <span data-testid="confidence-tier" className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
          tier === "High" && "border-primary/30 bg-primary/10 text-primary",
          tier === "Medium" && "border-amber-400/30 bg-amber-400/10 text-amber-300",
          isLowTier(tier) && "border-white/15 bg-white/[0.05] text-[#CFCFCF]")}>
          {tierText(tier)} confidence
        </span>
      </div>
      {reason && <p className="mt-2 text-[13px] leading-[1.55] text-[#C4C4C4]">{reason}</p>}
      {checksReason && !isLowTier(tier) && <p className="mt-2 text-[13px] leading-[1.55] text-[#C4C4C4]">{checksReason}</p>}
      {Array.isArray(sources) && sources.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-[#A8A8A8]">Data used</p>
          <ul className="mt-1.5 space-y-1.5">
            {sources.map((s) => (
              <li key={s} className="flex gap-2 text-[13px] leading-snug text-[#D6D6D6]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />{s}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
