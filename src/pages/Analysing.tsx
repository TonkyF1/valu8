import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading vehicle details",
  "Cross-referencing UK market data",
  "Analysing photos for condition",
  "Computing three-tier valuation",
  "Generating your full report",
];

export default function Analysing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => { document.title = "Analysing your vehicle — Valu8"; }, []);

  useEffect(() => {
    const timers: number[] = [];
    STEPS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setStep(i + 1), (i + 1) * 700));
    });
    timers.push(window.setTimeout(() => navigate(`/valuation/${id}`, { replace: true }), STEPS.length * 700 + 600));
    return () => timers.forEach(clearTimeout);
  }, [id, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 grid place-items-center px-4 py-16 hero-glow">
        <div className="w-full max-w-md text-center animate-fade-in-up">
          <div className="relative mx-auto h-24 w-24 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-30 blur-2xl animate-pulse-glow" />
            <div className="relative h-full w-full rounded-full bg-gradient-primary grid place-items-center shadow-glow">
              <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analysing Your Vehicle</h1>
          <p className="text-muted-foreground mt-2">Sit tight — your full report is moments away.</p>

          <ul className="mt-10 text-left space-y-3">
            {STEPS.map((s, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <li key={s} className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                  done ? "border-primary/30 bg-primary/5" : active ? "border-border bg-card" : "border-border/50 bg-card/50 opacity-60"
                )}>
                  <span className={cn(
                    "h-6 w-6 rounded-full grid place-items-center text-xs flex-shrink-0",
                    done ? "bg-primary text-primary-foreground" : active ? "border border-primary text-primary" : "border border-border text-muted-foreground"
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                  </span>
                  <span className={cn("text-sm font-medium", done ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
