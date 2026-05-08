interface Props {
  score: number;
  label: string;
}

function getScoreColor(score: number): string {
  if (score <= 3) return "hsl(0 72% 55%)";          /* Poor — Red */
  if (score <= 5) return "hsl(25 95% 53%)";          /* Fair — Orange */
  if (score <= 7) return "hsl(45 90% 50%)";          /* Good — Yellow/Green */
  if (score <= 9) return "hsl(176 100% 42%)";        /* Great — Teal */
  return "hsl(270 70% 60%)";                         /* Outstanding — Purple */
}

function getScoreGradient(score: number): string {
  if (score <= 3) return "linear-gradient(90deg, hsl(0 72% 45%), hsl(0 72% 55%))";
  if (score <= 5) return "linear-gradient(90deg, hsl(25 95% 48%), hsl(25 95% 53%))";
  if (score <= 7) return "linear-gradient(90deg, hsl(45 85% 45%), hsl(45 90% 50%))";
  if (score <= 9) return "linear-gradient(90deg, hsl(176 100% 36%), hsl(176 100% 55%))";
  return "linear-gradient(90deg, hsl(270 65% 50%), hsl(270 70% 70%))";
}

export function ConditionGauge({ score, label }: Props) {
  const pct = Math.max(0, Math.min(1, score / 10)) * 100;
  const barColor = getScoreColor(score);
  const barGradient = getScoreGradient(score);

  return (
    <div className="w-full">
      {/* Score + Label row */}
      <div className="flex items-end justify-between mb-2.5">
        <div>
          <div className="text-3xl font-bold tabular-nums leading-none" style={{ color: barColor }}>
            {score.toFixed(1)}
            <span className="text-sm font-medium text-muted-foreground ml-1">/ 10</span>
          </div>
        </div>
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full border"
          style={{
            color: barColor,
            borderColor: `${barColor.replace(')', ' / 0.35)')}`,
            backgroundColor: `${barColor.replace(')', ' / 0.08)')}`,
          }}
        >
          {label}
        </div>
      </div>

      {/* Track + fill */}
      <div className="relative h-3 w-full rounded-full overflow-hidden bg-muted/60">
        {/* Background segments for visual scale */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-background/40" />
          <div className="flex-1 border-r border-background/40" />
          <div className="flex-1 border-r border-background/40" />
          <div className="flex-1 border-r border-background/40" />
          <div className="flex-1" />
        </div>
        {/* Fill bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: barGradient,
            transition: "width 1s cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: `0 0 12px ${barColor.replace(')', ' / 0.5)')}`,
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/60 uppercase tracking-wider">
        <span>Poor</span>
        <span>Fair</span>
        <span>Good</span>
        <span>Great</span>
        <span className="text-right">Outstanding</span>
      </div>

      <div className="sr-only">
        Condition score {score.toFixed(1)} out of 10, rated {label}
      </div>
    </div>
  );
}
