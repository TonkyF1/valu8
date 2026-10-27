import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Admin-only: readiness_stats() raises 'forbidden' unless the caller is an admin.
// Aggregates only — no registrations, user ids or emails.
type Stats = {
  n_in_band: number; median_abs_pct: number | null; median_signed_pct: number | null; within_10_pct: number | null;
  miss_30_pct: number | null; recent_90d_share: number | null; rejected: Record<string, number> | null; all_bands_n: number;
  breakdown: { band: string | null; side: string | null; pricing_source: string | null; engine_version: string | null; confidence: string | null; n: number; median_abs_pct: number; within_10_pct: number; miss_30_pct: number }[];
  weekly: { wk: string; n_week: number; n_cumulative: number }[];
  funnel: { kind: string; checks: number; asked: number; answered: number; usable: number }[];
};

export const LIVE_ENGINE = "v2.2-ledger";
type Tone = "green" | "amber" | "red";
const TONE: Record<Tone, string> = { green: "border-emerald-400/40 text-emerald-400", amber: "border-amber-400/40 text-amber-400", red: "border-red-400/40 text-red-400" };

export function gates(all: Stats, live: Stats | null) {
  const n = all.n_in_band, med = all.median_abs_pct, miss = all.miss_30_pct;
  const g = (pass: boolean, near: boolean): Tone => (pass ? "green" : near ? "amber" : "red");
  const liveOk = !!live && (live.n_in_band >= 100 || (live.n_in_band >= 200 && (live.median_abs_pct ?? 99) <= 12 && (live.miss_30_pct ?? 99) < 5));
  const list = [
    { id: "G1", label: "Outcomes on £5–20k estimates", value: `${n}`, target: "≥ 200", tone: g(n >= 200, n >= 180), core: true },
    { id: "G2", label: "Median absolute error", value: med == null ? "—" : `${med}%`, target: "≤ 12%", tone: med == null ? "red" as Tone : g(med <= 12, med <= 13.2), core: true },
    { id: "G3", label: "Misses over 30%", value: miss == null ? "—" : `${miss}%`, target: "< 5%", tone: miss == null ? "red" as Tone : g(miss < 5, miss < 5.5), core: true },
    { id: "G4", label: "Recorded in last 90 days", value: all.recent_90d_share == null ? "—" : `${all.recent_90d_share}%`, target: "≥ 50%", tone: all.recent_90d_share == null ? "red" as Tone : g(all.recent_90d_share >= 50, all.recent_90d_share >= 45), core: false },
    { id: "G5", label: "Median signed error", value: all.median_signed_pct == null ? "—" : `${all.median_signed_pct}%`, target: "−6% to +6%", tone: all.median_signed_pct == null ? "red" as Tone : g(Math.abs(all.median_signed_pct) <= 6, Math.abs(all.median_signed_pct) <= 6.6), core: false },
    { id: "G6", label: `Current engine (${LIVE_ENGINE})`, value: live ? `${live.n_in_band} outcomes` : "—", target: "passes, or ≥ 100", tone: liveOk ? "green" as Tone : "red" as Tone, core: false },
  ];
  // Never READY on fewer than 200 in-band outcomes.
  const ready = n >= 200 && med != null && med <= 12 && miss != null && miss < 5;
  return { list, ready };
}

export function ReadinessPanel() {
  const [all, setAll] = useState<Stats | null>(null);
  const [live, setLive] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const rpc = (supabase as any).rpc;
    Promise.all([rpc.call(supabase, "readiness_stats"), rpc.call(supabase, "readiness_stats", { p_engine: LIVE_ENGINE })])
      .then(([a, b]: any[]) => { if (a.error || !a.data) setErr(true); else { setAll(a.data); setLive(b.data ?? null); } })
      .catch(() => setErr(true));
  }, []);
  if (err) return <p className="mt-6 text-sm text-muted-foreground">Couldn't load readiness stats.</p>;
  if (!all) return <p className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</p>;
  const { list, ready } = gates(all, live);
  const failing = list.filter((x) => x.core && x.tone !== "green").map((x) => x.id);
  const weekly = all.weekly ?? [];
  const maxCum = Math.max(200, ...weekly.map((w) => Number(w.n_cumulative)));
  const dim = (r: Stats["breakdown"][number]) =>
    r.band ? ["Price band", r.band] : r.side ? ["Side", r.side] : r.pricing_source ? ["Source", r.pricing_source] : r.engine_version ? ["Engine", r.engine_version] : r.confidence ? ["Confidence", r.confidence] : ["—", "(none)"];

  return (
    <div className="mt-6 space-y-8">
      <div className={`rounded-2xl border-2 p-5 ${ready ? TONE.green : TONE.red}`} role="status">
        <p className="text-2xl font-bold">{ready ? "READY" : "NOT READY"}</p>
        <p className="text-sm text-muted-foreground mt-1">{ready ? "All core gates pass." : `Failing: ${failing.join(", ")}`} Only real, user-reported sale and purchase prices count.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map((x) => (
          <div key={x.id} className={`rounded-xl border p-4 ${TONE[x.tone]}`}>
            <p className="text-xs text-muted-foreground">{x.id}{x.core ? "" : " · guard-rail"} · {x.label}</p>
            <p className="text-xl font-semibold mt-1">{x.value}</p>
            <p className="text-xs text-muted-foreground">Target {x.target}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-semibold">Weekly progress to 200</h2>
        {weekly.length === 0 ? <p className="text-sm text-muted-foreground mt-2">No outcomes yet.</p> : (
          <div className="mt-3 space-y-1.5">
            {weekly.map((w) => (
              <div key={w.wk} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-muted-foreground tabular-nums">{w.wk}</span>
                <div className="relative flex-1 h-3 rounded bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded bg-primary/60" style={{ width: `${(Number(w.n_cumulative) / maxCum) * 100}%` }} />
                  <div className="absolute inset-y-0 w-px bg-foreground" style={{ left: `${(200 / maxCum) * 100}%` }} aria-hidden />
                </div>
                <span className="w-24 tabular-nums">+{w.n_week} · {w.n_cumulative}</span>
              </div>
            ))}
          </div>
        )}
        {all.rejected && <p className="text-xs text-muted-foreground mt-2">Rejected (shown, not counted): {Object.entries(all.rejected).map(([k, v]) => `${k} ${v}`).join(", ")}</p>}
      </section>

      <section>
        <h2 className="font-semibold">Breakdown (all bands, {all.all_bands_n} usable)</h2>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr><th className="py-1.5 pr-3">Group</th><th className="pr-3">Value</th><th className="pr-3">n</th><th className="pr-3">Median abs</th><th className="pr-3">Within 10%</th><th>Over 30%</th></tr>
            </thead>
            <tbody>
              {(all.breakdown ?? []).map((r, i) => { const [g, v] = dim(r); return (
                <tr key={i} className="border-t border-border tabular-nums">
                  <td className="py-1.5 pr-3 text-muted-foreground">{g}</td><td className="pr-3">{v}</td><td className="pr-3">{r.n}</td>
                  <td className="pr-3">{r.median_abs_pct}%</td><td className="pr-3">{r.within_10_pct}%</td><td>{r.miss_30_pct}%</td>
                </tr>); })}
              {(all.breakdown ?? []).length === 0 && <tr><td colSpan={6} className="py-2 text-muted-foreground">No outcomes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Follow-up funnel</h2>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left"><tr><th className="py-1.5 pr-3">Kind</th><th className="pr-3">Checks</th><th className="pr-3">Asked</th><th className="pr-3">Answered</th><th>Usable outcome</th></tr></thead>
            <tbody>
              {(all.funnel ?? []).map((f) => (
                <tr key={f.kind} className="border-t border-border tabular-nums">
                  <td className="py-1.5 pr-3 capitalize">{f.kind}</td><td className="pr-3">{f.checks}</td><td className="pr-3">{f.asked}</td><td className="pr-3">{f.answered}</td><td>{f.usable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
