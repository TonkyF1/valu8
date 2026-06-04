import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Reading vehicle details", sub: "Pulling official DVSA record" },
  { label: "Cross-referencing UK market data", sub: "50,000+ live listings scanned" },
  { label: "Analysing photos for condition", sub: "AI vision reading panels & wheels" },
  { label: "Computing three-tier valuation", sub: "Trade-in, private, and asking price" },
  { label: "Generating your full report", sub: "Building the data buyers can't argue with" },
];

const REASSURANCES = [
  "Comparing against live UK listings…",
  "Detecting panel condition and wheel wear…",
  "Factoring MOT history and recorded mileage…",
  "Calculating your strongest negotiation angle…",
  "Building the data your buyers can't argue with…",
];

export default function Analysing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => { document.title = "Analysing your vehicle — Valu8"; }, []);

  useEffect(() => {
    const timers: number[] = [];
    STEPS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setStep(i + 1), (i + 1) * 700));
    });
    timers.push(window.setTimeout(() => navigate(`/valuation/${id}`, { replace: true }), STEPS.length * 700 + 600));
    return () => timers.forEach(clearTimeout);
  }, [id, navigate]);

  useEffect(() => {
    const i = window.setInterval(() => setTip((v) => (v + 1) % REASSURANCES.length), 2400);
    return () => clearInterval(i);
  }, []);

  const overall = Math.min(100, Math.round((step / STEPS.length) * 100));
  const circ = 2 * Math.PI * 46;
  const offset = circ - (overall / 100) * circ;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 grid place-items-center px-4 py-12 sm:py-16 hero-glow">
        <div className="w-full max-w-md text-center animate-fade-in-up premium-card p-7 sm:p-9 relative overflow-hidden">
          <div className="absolute -top-32 -right-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative mx-auto h-32 w-32 mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse-glow" />
            <svg className="relative w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
              <circle
                cx="50" cy="50" r="46" fill="none"
                stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                className="transition-all duration-700 ease-out"
                style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.55))" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-3xl font-semibold tabular-nums text-gradient-primary leading-none">
                {overall}<span className="text-base text-primary/70">%</span>
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Analysing your vehicle</h1>
          <p
            key={tip}
            className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5 animate-fade-in-up"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            {REASSURANCES[tip]}
          </p>

          <ul className="mt-7 text-left space-y-2.5 relative">
            {STEPS.map((s, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <li key={s.label} className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all",
                  done ? "border-primary/30 bg-primary/5"
                    : active ? "border-primary/40 bg-card shadow-[0_0_28px_-12px_hsl(var(--primary)/0.5)]"
                    : "border-border/40 bg-card/40 opacity-55"
                )}>
                  <span className={cn(
                    "h-7 w-7 rounded-full grid place-items-center text-xs flex-shrink-0 transition-all",
                    done ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                      : active ? "border border-primary text-primary"
                      : "border border-border text-muted-foreground"
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium", done || active ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">{s.sub}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
