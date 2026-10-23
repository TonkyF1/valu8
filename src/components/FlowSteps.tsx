import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const FLOW_STEPS = ["Reg", "Details", "Photos", "Report"] as const;

/** Compact 4-step progress indicator for the valuation flow. `current` is 0-based. */
export function FlowSteps({ current, className }: { current: number; className?: string }) {
  return (
    <ol aria-label="Valuation progress" className={cn("flex items-center w-full max-w-md mx-auto", className)}>
      {FLOW_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center flex-1 last:flex-none" aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary bg-primary/10 ring-4 ring-primary/10",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <span aria-hidden className={cn("mx-2 mb-5 h-px flex-1", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
