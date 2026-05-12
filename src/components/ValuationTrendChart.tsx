import { useMemo } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  currentValue: number;
  registrationYear: number;
}

// Rough new-car price estimate working backwards from current value & age.
// Cars typically lose ~50-65% of value over 8-10 years, then depreciation flattens.
function estimateNewPrice(currentValue: number, ageYears: number) {
  if (ageYears <= 0) return currentValue;
  // Inverse depreciation curve
  const retention = Math.max(0.18, Math.pow(0.86, ageYears));
  return Math.round(currentValue / retention);
}

function generateLifetimeData(currentValue: number, registrationYear: number) {
  const nowYear = new Date().getFullYear();
  const ageYears = Math.max(1, nowYear - registrationYear);
  const newPrice = estimateNewPrice(currentValue, ageYears);

  const data: { year: string; value: number }[] = [];
  for (let i = 0; i <= ageYears; i++) {
    const year = registrationYear + i;
    // Depreciation curve: steeper early, flatter later
    const t = i / ageYears;
    const curve = 1 - Math.pow(t, 0.7); // value retention factor
    const base = currentValue + (newPrice - currentValue) * curve;
    const noise = Math.sin(i * 1.7) * 0.012 * base;
    data.push({
      year: String(year),
      value: Math.round(base + noise),
    });
  }
  // Pin endpoints exactly
  data[0].value = newPrice;
  data[data.length - 1].value = currentValue;
  return data;
}

export function ValuationTrendChart({ currentValue, registrationYear }: Props) {
  const data = useMemo(
    () => generateLifetimeData(currentValue, registrationYear),
    [currentValue, registrationYear]
  );

  const tickInterval = data.length > 8 ? Math.ceil(data.length / 6) - 1 : 0;

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
        Valuation Trend (Lifetime)
      </div>
      <div className="h-[72px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00D4C8" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#00D4C8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="year"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(0 0% 60%)", letterSpacing: "0.04em" }}
              interval={tickInterval}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-md bg-popover border border-border px-2.5 py-1.5 text-xs shadow-lg">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                    <span className="tabular-nums text-foreground">
                      £{Number(payload[0].value).toLocaleString()}
                    </span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00D4C8"
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={{ r: 2.5, fill: "#00D4C8", stroke: "#111111", strokeWidth: 1.5 }}
              activeDot={{ r: 4, fill: "#00D4C8", stroke: "#111111", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
