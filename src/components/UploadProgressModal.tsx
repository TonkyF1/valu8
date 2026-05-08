import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadPhase = "uploading" | "analysing" | "generating" | "done";

interface Props {
  open: boolean;
  phase: UploadPhase;
  uploadProgress: number; // 0-100
}

const STEPS: { key: UploadPhase; label: string; sublabel: string }[] = [
  { key: "uploading", label: "Uploading photos", sublabel: "Securely sending your images" },
  { key: "analysing", label: "Analysing vehicle condition", sublabel: "Reading photos & service history" },
  { key: "generating", label: "Generating valuation report", sublabel: "Cross-referencing UK market data" },
];

export function UploadProgressModal({ open, phase, uploadProgress }: Props) {
  if (!open) return null;

  const phaseIndex = STEPS.findIndex((s) => s.key === phase);
  const overall =
    phase === "done"
      ? 100
      : phase === "uploading"
      ? Math.round(uploadProgress * 0.4)
      : phase === "analysing"
      ? 40 + 30
      : 70 + 25;

  const circ = 2 * Math.PI * 46;
  const offset = circ - (overall / 100) * circ;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-md animate-fade-in-up px-4">
      <div className="w-full max-w-md premium-card p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Circular progress wheel */}
        <div className="relative mx-auto h-28 w-28 mb-5">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
              style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.4))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-2xl font-semibold tabular-nums text-gradient-primary">{overall}%</div>
          </div>
        </div>

        <h2 className="text-xl font-semibold tracking-tight">
          {phase === "done" ? "All set!" : "Building your report"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          This usually takes 20–40 seconds. Hang tight.
        </p>

        <ul className="mt-7 text-left space-y-2.5">
          {STEPS.map((s, i) => {
            const done = phase === "done" || i < phaseIndex;
            const active = i === phaseIndex && phase !== "done";
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all",
                  done
                    ? "border-primary/30 bg-primary/5"
                    : active
                    ? "border-primary/40 bg-card shadow-[0_0_24px_-12px_hsl(var(--primary)/0.4)]"
                    : "border-border/50 bg-card/40 opacity-60"
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center text-xs flex-shrink-0",
                    done
                      ? "bg-primary text-primary-foreground"
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
                  <div className={cn("text-sm font-medium", done || active ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                    {active && s.key === "uploading" && (
                      <span className="ml-2 text-xs text-primary tabular-nums">{Math.round(uploadProgress)}%</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{s.sublabel}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
