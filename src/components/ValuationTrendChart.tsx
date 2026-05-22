import { useEffect, useState } from "react";
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

export function ValuationTrendChart({ currentValue, registrationYear, make, model }: Props) {
  const [data, setData] = useState<Point[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!make || !model) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("historical-valuation", {
        body: { make, model: model.split(" · ")[0], year: registrationYear, currentValue },
      })
      .then(({ data: resp }) => {
        if (cancelled) return;
        const series = (resp as any)?.series as Point[] | null;
        const source = (resp as any)?.source as string | undefined;
        const respNote = (resp as any)?.note as string | undefined;
        if (series && series.length > 1 && source === "marketcheck") {
          setData(series);
          setNote(respNote ?? null);
        } else {
          setData(null);
          setNote(null);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [make, model, registrationYear, currentValue]);

  if (loading) {
    return (
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
          Valuation Trend (Lifetime)
        </div>
        <div className="h-[72px] w-full rounded-md bg-muted/20 animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const tickInterval = data.length > 8 ? Math.ceil(data.length / 6) - 1 : 0;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Valuation Trend (Lifetime)
        </div>
        <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">
          MarketCheck UK
        </div>
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
