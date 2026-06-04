import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadPhase = "uploading" | "analysing" | "generating" | "done";

interface Props {
  open: boolean;
  phase: UploadPhase;
  uploadProgress: number; // 0-100
}

const STEPS: { key: UploadPhase; label: string; sublabel: string }[] = [
  { key: "uploading", label: "Uploading photos", sublabel: "Securely sending your images" },
  { key: "analysing", label: "Reading photos & history", sublabel: "AI scanning condition, panels, wheels" },
  { key: "generating", label: "Building your report", sublabel: "Cross-referencing live UK market data" },
];

const REASSURANCES = [
  "Comparing against 50,000+ live UK listings…",
  "Detecting panel condition and wheel wear…",
  "Factoring MOT history and recorded mileage…",
  "Calculating your strongest negotiation angle…",
  "Finding the closest real-market comparisons…",
  "Building the data your buyers can't argue with…",
];

export function UploadProgressModal({ open, phase, uploadProgress }: Props) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const i = window.setInterval(() => {
      setTipIndex((v) => (v + 1) % REASSURANCES.length);
    }, 2600);
    return () => clearInterval(i);
  }, [open]);

  if (!open) return null;

  const phaseIndex = STEPS.findIndex((s) => s.key === phase);
  const overall =
    phase === "done"
      ? 100
      : phase === "uploading"
      ? Math.round(uploadProgress * 0.4)
      : phase === "analysing"
      ? 70
      : 95;

  const circ = 2 * Math.PI * 46;
  const offset = circ - (overall / 100) * circ;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/85 backdrop-blur-xl animate-fade-in-up px-4">
      <div className="w-full max-w-md premium-card p-7 sm:p-9 text-center relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute -top-32 -right-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Circular progress wheel */}
        <div className="relative mx-auto h-32 w-32 mb-6">
          {/* outer pulsing ring */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse-glow" />
          <svg className="relative w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
              style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.55))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-semibold tabular-nums text-gradient-primary leading-none">{overall}<span className="text-base text-primary/70">%</span></div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-1.5">
                {phase === "done" ? "Complete" : "Working"}
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight">
          {phase === "done" ? "All set." : "Building your report"}
        </h2>

        {/* Rotating reassurance */}
        <div className="mt-2.5 h-5 relative">
          <p
            key={tipIndex}
            className="text-sm text-muted-foreground animate-fade-in-up inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            {phase === "done" ? "Taking you to your valuation…" : REASSURANCES[tipIndex]}
          </p>
        </div>

        <ul className="mt-7 text-left space-y-2.5 relative">
          {STEPS.map((s, i) => {
            const done = phase === "done" || i < phaseIndex;
            const active = i === phaseIndex && phase !== "done";
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all",
                  done
                    ? "border-primary/30 bg-primary/5"
                    : active
                    ? "border-primary/40 bg-card shadow-[0_0_28px_-12px_hsl(var(--primary)/0.5)]"
                    : "border-border/40 bg-card/40 opacity-55"
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center text-xs flex-shrink-0 transition-all",
                    done
                      ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                      : active
                      ? "border border-primary text-primary"
                      : "border border-border text-muted-foreground"
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium flex items-center gap-2", done || active ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                    {active && s.key === "uploading" && (
                      <span className="text-[11px] text-primary tabular-nums font-semibold">{Math.round(uploadProgress)}%</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground/80">{s.sublabel}</div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          Don't close this window
        </p>
      </div>
    </div>
  );
}
