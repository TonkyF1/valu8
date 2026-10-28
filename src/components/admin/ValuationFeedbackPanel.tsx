import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VERDICT_LABELS, isVerdict, pctDifference } from "@/lib/valuationFeedback";

// Admin-only: admin_valuation_feedback() raises 'Forbidden' unless the caller is an admin.
// "Does this sound right?" answers are a signal only — they never feed pricing.
type Row = {
  valuation_id: string; verdict: string | null; user_estimate: number | null; followup_opt_in: boolean;
  updated_at: string; valu8_value: number | null; car: string; mileage: number | null; guest: boolean;
};
type Stats = { total: number; by_verdict: Record<string, number>; with_estimate: number; followup_opt_in: number; recent: Row[] };

export function ValuationFeedbackPanel() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (supabase as any).rpc("admin_valuation_feedback").then(({ data, error }: any) => {
      if (error) setErr(error.message); else setS(data as Stats);
    });
  }, []);
  if (err) return <p className="text-sm text-destructive mb-6">Valuation feedback: {err}</p>;
  if (!s) return <div className="py-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const tile = (label: string, value: number | string, sub?: string) => (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
  const n = (k: string) => s.by_verdict?.[k] ?? 0;
  return (
    <section className="mb-8 space-y-4" aria-labelledby="vfb-h">
      <h2 id="vfb-h" className="text-lg font-semibold">“Does this sound right?” feedback <span className="text-xs font-normal text-muted-foreground">(internal, signal only — not used in pricing)</span></h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tile("Answers", s.total, `${s.with_estimate} with an estimate`)}
        {tile("Too low", n("too_low"))}
        {tile("About right", n("about_right"))}
        {tile("Too high", n("too_high"))}
        {tile("Asked for follow-up", s.followup_opt_in)}
      </div>
      <div className="rounded-xl border border-border overflow-x-auto">
        {(s.recent ?? []).length === 0 ? <p className="text-sm text-muted-foreground p-4">None yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium p-3">Car</th>
                <th className="text-right font-medium p-3">Valu8 value</th>
                <th className="text-left font-medium p-3">Verdict</th>
                <th className="text-right font-medium p-3">User estimate</th>
                <th className="text-right font-medium p-3">Difference</th>
                <th className="text-left font-medium p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((r) => {
                const d = pctDifference(r.user_estimate, r.valu8_value);
                return (
                  <tr key={r.valuation_id} className="border-b border-border/50 last:border-0">
                    <td className="p-3"><Link to={`/shared/${r.valuation_id}`} className="hover:underline">{r.car || "—"}</Link>{r.mileage ? <span className="text-muted-foreground"> · {r.mileage.toLocaleString("en-GB")} mi</span> : null}{r.guest && <span className="text-[11px] text-muted-foreground"> · guest</span>}</td>
                    <td className="p-3 text-right tabular-nums">{r.valu8_value ? `£${r.valu8_value.toLocaleString("en-GB")}` : "—"}</td>
                    <td className="p-3">{isVerdict(r.verdict) ? VERDICT_LABELS[r.verdict] : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{r.user_estimate ? `£${r.user_estimate.toLocaleString("en-GB")}` : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{d === null ? "—" : `${d > 0 ? "+" : ""}${d}%`}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(r.updated_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
