import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Admin-only: admin_growth_stats() raises 'Forbidden' unless the caller is an admin.
// Aggregate counts only: no user ids, emails or registrations.
type Growth = {
  outcomes_total: number; outcomes_priced: number; outcomes_7d: number; outcomes_30d: number;
  outcomes_by_type: Record<string, number>; readiness_outcomes: number;
  signups_7d: number; signups_30d: number; referred_signups: number; referrers_with_code: number;
  signups_by_source_30d: { source: string; n: number }[];
};

export function GrowthPanel() {
  const [g, setG] = useState<Growth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (supabase as any).rpc("admin_growth_stats").then(({ data, error }: any) => {
      if (error) setErr(error.message); else setG(data as Growth);
    });
  }, []);
  if (err) return <p className="text-sm text-destructive mb-6">Growth stats: {err}</p>;
  if (!g) return <div className="py-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const tile = (label: string, value: number | string, sub?: string) => (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
  const types = Object.entries(g.outcomes_by_type ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <section className="mb-8 space-y-4" aria-labelledby="growth-h">
      <h2 id="growth-h" className="text-lg font-semibold">Outcomes &amp; growth <span className="text-xs font-normal text-muted-foreground">(internal)</span></h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tile("Outcomes recorded", g.outcomes_total, `${g.outcomes_priced} with a price`)}
        {tile("Outcomes, last 7 days", g.outcomes_7d, `${g.outcomes_30d} in 30 days`)}
        {tile("Usable for readiness", g.readiness_outcomes, "readiness_outcomes rows")}
        {tile("Sign-ups, last 7 days", g.signups_7d, `${g.signups_30d} in 30 days`)}
        {tile("Joined via a friend", g.referred_signups, `${g.referrers_with_code} users have a share link`)}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium mb-2">Outcomes by kind / answer</p>
          {types.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
            <ul className="text-sm space-y-1">{types.map(([k, n]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{n}</span></li>)}</ul>
          )}
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium mb-2">Sign-ups by source, last 30 days</p>
          {(g.signups_by_source_30d ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
            <ul className="text-sm space-y-1">{g.signups_by_source_30d.map((r) => <li key={r.source} className="flex justify-between"><span>{r.source}</span><span className="tabular-nums">{r.n}</span></li>)}</ul>
          )}
        </div>
      </div>
    </section>
  );
}
