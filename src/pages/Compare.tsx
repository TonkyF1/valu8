import { useSeo } from "@/lib/seo";
import { headlinePrivateText } from "../../supabase/functions/_shared/cheapRange";
import { normaliseReportPricing } from "@/lib/askingPrice";
import { getRouteMeta } from "@/data/routeMeta";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import type { ValuationReport } from "@/lib/valuation";
import { estimateUlez, estimateVed, summariseAdvisoryCosts } from "../../supabase/functions/_shared/insights";
import { hasPhotos } from "@/lib/askingPrice";

interface Row { id: string; make: string; model: string; year: number; mileage: number; registration: string | null; report: ValuationReport; created_at: string; photo_urls?: unknown }

const gbp = (n?: number | null) => (n == null || !Number.isFinite(n) ? "—" : `£${Math.round(n).toLocaleString("en-GB")}`);

function facts(v: Row) {
  const r = v.report ?? ({} as ValuationReport);
  const veh = r.vehicle ?? {};
  const ved = estimateVed({ firstRegistered: veh.firstRegistered, year: v.year, fuelType: veh.fuelType, co2: veh.co2Emissions, engineCc: veh.engineCapacity });
  const ulez = estimateUlez({ fuelType: veh.fuelType, year: v.year, firstRegistered: veh.firstRegistered, euroStatus: veh.euroStatus });
  const adv = r.motSource === "dvsa" ? r.motHistory?.[0]?.advisories ?? [] : [];
  const costs = summariseAdvisoryCosts(adv);
  return [
    ["Private sale", r.values?.privateSale ? headlinePrivateText(normaliseReportPricing(r).privateSale, r) : gbp(undefined)],
    ["Dealer retail", gbp(r.values?.privateSale ? normaliseReportPricing(r).retail : undefined)],
    ["Trade-in", gbp(r.values?.privateSale ? normaliseReportPricing(r).tradeIn : undefined)],
    ["Condition", r.conditionScore != null && hasPhotos(v.photo_urls) ? `${r.conditionScore}/10 (${r.conditionLabel})` : "Add photos to score"],
    ["Year", String(v.year)],
    ["Mileage", `${v.mileage.toLocaleString("en-GB")} mi`],
    ["Fuel", veh.fuelType ?? "—"],
    ["Tax (est.)", ved.annual != null ? `${gbp(ved.annual)}/yr${ved.supplementPossible ? " (+£440 if list price was over £40k)" : ""}` : "—"],
    ["ULEZ (est.)", ulez.status === "likely_compliant" ? "Likely compliant" : ulez.status === "likely_non_compliant" ? "Likely non-compliant" : "Check"],
    ["Current MOT advisories", String(adv.length)],
    ["Advisory repairs (est.)", costs.high > 0 ? `${gbp(costs.low)}–${gbp(costs.high)}` : "—"],
    ["Market confidence", r.marketConfidence ?? "—"],
  ] as [string, string][];
}

export default function Compare() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const a = params.get("a") ?? "", b = params.get("b") ?? "";
  useSeo(getRouteMeta("/compare"));
  useEffect(() => {
    if (!user) return;
    supabase.from("valuations").select("id, make, model, year, mileage, registration, report, created_at, photo_urls")
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [user]);

  const A = useMemo(() => rows.find((r) => r.id === a), [rows, a]);
  const B = useMemo(() => rows.find((r) => r.id === b), [rows, b]);
  const label = (r: Row) => `${r.year} ${r.make} ${r.model}${r.registration ? ` (${r.registration})` : ""}`;
  const pick = (k: "a" | "b", id: string) => { const p = new URLSearchParams(params); p.set(k, id); setParams(p, { replace: true }); };

  const fa = A ? facts(A) : null, fb = B ? facts(B) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-4xl py-10">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ArrowLeftRight className="h-6 w-6 text-primary" aria-hidden /> Compare two cars</h1>
        <p className="text-sm text-muted-foreground mt-2">Pick two of your saved valuations to see them side by side.</p>

        {rows.length < 2 ? (
          <p className="mt-6 text-sm">You need at least two valuations to compare. <Link className="text-primary underline" to="/valuation/new">Start one</Link>.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              {(["a", "b"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`cmp-${k}`} className="text-xs text-muted-foreground">Car {k.toUpperCase()}</label>
                  <select id={`cmp-${k}`} value={k === "a" ? a : b} onChange={(e) => pick(k, e.target.value)}
                    className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose a valuation…</option>
                    {rows.map((r) => <option key={r.id} value={r.id}>{label(r)}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {fa && fb && A && B && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">Comparison of {label(A)} and {label(B)}</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="text-left py-2 pr-3 font-medium text-muted-foreground"> </th>
                      <th scope="col" className="text-left py-2 px-3"><Link className="hover:underline" to={`/valuation/${A.id}`}>{label(A)}</Link></th>
                      <th scope="col" className="text-left py-2 px-3"><Link className="hover:underline" to={`/valuation/${B.id}`}>{label(B)}</Link></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fa.map(([k, va], i) => (
                      <tr key={k} className="border-b border-border/50">
                        <th scope="row" className="text-left py-2 pr-3 font-normal text-muted-foreground whitespace-nowrap">{k}</th>
                        <td className="py-2 px-3">{va}</td>
                        <td className="py-2 px-3">{fb[i][1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground mt-3">Tax, ULEZ and repair figures are estimates. Valuations reflect the date each report was generated.</p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
