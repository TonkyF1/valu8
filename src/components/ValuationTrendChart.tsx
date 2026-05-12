import { useMemo } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths } from "date-fns";

interface Props {
  currentValue: number;
}

function generateTrendData(currentValue: number) {
  const now = new Date();
  const startValue = Math.round(currentValue * 0.88);
  const data = [];
  for (let i = 11; i >= 0; i--) {
    const date = subMonths(now, i);
    const progress = (11 - i) / 11;
    const noise = Math.round(
      (Math.sin(i * 1.3) * 0.015 + Math.cos(i * 2.1) * 0.008) * currentValue
    );
    const value = Math.round(startValue + (currentValue - startValue) * progress) + noise;
    data.push({
      month: format(date, "MMM"),
      value,
    });
  }
  return data;
}

export function ValuationTrendChart({ currentValue }: Props) {
  const data = useMemo(() => generateTrendData(currentValue), [currentValue]);

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
        Valuation Trend (Last 12 Months)
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
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(0 0% 60%)", letterSpacing: "0.04em" }}
              interval={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-md bg-popover border border-border px-2.5 py-1.5 text-xs shadow-lg">
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
