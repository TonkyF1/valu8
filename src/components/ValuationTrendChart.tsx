import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  currentValue: number;
  registrationYear: number;
  make?: string;
  model?: string;
}

interface Point {
  year: string;
  value: number;
}

function estimateNewPrice(currentValue: number, ageYears: number) {
  if (ageYears <= 0) return currentValue;
  const retention = Math.max(0.18, Math.pow(0.86, ageYears));
  return Math.round(currentValue / retention);
}

function generateLifetimeData(currentValue: number, registrationYear: number): Point[] {
  const nowYear = new Date().getFullYear();
  const ageYears = Math.max(1, nowYear - registrationYear);
  const newPrice = estimateNewPrice(currentValue, ageYears);
  const data: Point[] = [];
  for (let i = 0; i <= ageYears; i++) {
    const t = i / ageYears;
    const curve = 1 - Math.pow(t, 0.7);
    const base = currentValue + (newPrice - currentValue) * curve;
    const noise = Math.sin(i * 1.7) * 0.012 * base;
    data.push({ year: String(registrationYear + i), value: Math.round(base + noise) });
  }
  data[0].value = newPrice;
  data[data.length - 1].value = currentValue;
  return data;
}

export function ValuationTrendChart({ currentValue, registrationYear, make, model }: Props) {
  const fallback = useMemo(
    () => generateLifetimeData(currentValue, registrationYear),
    [currentValue, registrationYear]
  );
  const [data, setData] = useState<Point[]>(fallback);
  const [source, setSource] = useState<"marketcheck" | "estimate">("estimate");

  useEffect(() => {
    let cancelled = false;
    if (!make || !model) return;
    supabase.functions
      .invoke("historical-valuation", {
        body: { make, model: model.split(" · ")[0], year: registrationYear, currentValue },
      })
      .then(({ data: resp }) => {
        if (cancelled) return;
        const series = (resp as any)?.series as Point[] | null;
        if (series && series.length > 1) {
          setData(series);
          setSource("marketcheck");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [make, model, registrationYear, currentValue]);

  const tickInterval = data.length > 8 ? Math.ceil(data.length / 6) - 1 : 0;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Valuation Trend (Lifetime)
        </div>
        {source === "marketcheck" && (
          <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">
            MarketCheck UK
          </div>
        )}
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
