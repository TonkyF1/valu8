interface Props { score: number; label: string; size?: number; }

export function ConditionGauge({ score, label, size = 200 }: Props) {
  const pct = Math.max(0, Math.min(1, score / 10));
  const r = 80;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const angle = pct * 360;
  const strokeW = size < 120 ? 8 : 10;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} stroke="hsl(var(--border))" strokeWidth={strokeW} fill="none" />
        <circle
          cx="100" cy="100" r={r}
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeW} strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-gradient-primary tabular-nums">{score.toFixed(1)}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">/ 10</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
      <div className="sr-only">Condition score {score} out of 10, {label}, angle {angle}</div>
    </div>
  );
}
