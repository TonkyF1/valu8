import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { Component, useMemo, type ReactNode } from "react";
import { captureError } from "@/lib/sentry";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, ExternalLink, Gauge, Info, ListChecks, Receipt, ShieldAlert, Wind, Wrench } from "lucide-react";
import type { ValuationReport } from "@/lib/valuation";
import {
  analyseMileage, estimateUlez, estimateVed, sellerChecklist, summariseAdvisoryCosts,
  CAZ_CHECKER_URL, ULEZ_CHECKER_URL, VED_RATES_FROM, VED_SOURCE,
} from "../../supabase/functions/_shared/insights";

interface Props {
  report: ValuationReport;
  vehicle: { make: string; model: string; year: number; mileage: number; mot_expiry?: string | null; service_notes?: string | null };
  /** Seller-only sections (checklist) are hidden on shared links. */
  isShared?: boolean;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

function Card({ title, icon: Icon, children, tag }: { title: string; icon: any; children: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4 sm:p-5" aria-label={title}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden /> {title}</h3>
        {tag}
      </div>
      {children}
    </section>
  );
}

const EstimateTag = () => (
  <span className="text-[10px] uppercase tracking-wider rounded-full border border-border px-2 py-0.5 text-muted-foreground">Estimate</span>
);

export function VehicleInsights({ report, vehicle, isShared }: Props) {
  const r = report;
  const facts = r.vehicle ?? {};
  const baseModel = vehicle.model.split(" · ")[0];

  const mileage = useMemo(
    () => analyseMileage((r.motSource === "dvsa" ? r.motHistory ?? [] : []).map((m) => ({ date: m.date, mileage: m.mileage })), vehicle.mileage),
    [r.motHistory, r.motSource, vehicle.mileage],
  );
  const ved = useMemo(() => estimateVed({
    firstRegistered: facts.firstRegistered, year: vehicle.year, fuelType: facts.fuelType,
    co2: facts.co2Emissions, engineCc: facts.engineCapacity,
  }), [facts.firstRegistered, facts.fuelType, facts.co2Emissions, facts.engineCapacity, vehicle.year]);
  const ulez = useMemo(() => estimateUlez({
    fuelType: facts.fuelType, year: vehicle.year, firstRegistered: facts.firstRegistered, euroStatus: facts.euroStatus,
  }), [facts.fuelType, facts.firstRegistered, facts.euroStatus, vehicle.year]);
  const latestAdvisories = r.motSource === "dvsa" ? r.motHistory?.[0]?.advisories ?? [] : [];
  const costs = useMemo(() => summariseAdvisoryCosts(latestAdvisories), [r.motSource, r.motHistory]); // eslint-disable-line react-hooks/exhaustive-deps
  const checklist = useMemo(() => sellerChecklist({ motExpiry: vehicle.mot_expiry, hasServiceHistory: !!vehicle.service_notes }), [vehicle.mot_expiry, vehicle.service_notes]);


  const ulezStyle = ulez.status === "likely_compliant" ? "text-emerald-400" : ulez.status === "likely_non_compliant" ? "text-amber-400" : "text-muted-foreground";
  const ulezLabel = ulez.status === "likely_compliant" ? "Likely compliant" : ulez.status === "likely_non_compliant" ? "Likely non-compliant" : "Check required";

  return (
    <div className="space-y-4 my-8">
      <h2 className="text-lg font-semibold tracking-tight">Ownership insights</h2>

      {/* Mileage chart + clocking check */}
      <Card
        title="MOT mileage history"
        icon={Gauge}
        tag={mileage.status === "warning"
          ? <span className="text-[11px] font-medium text-amber-400 inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Check mileage</span>
          : mileage.status === "ok"
          ? <span className="text-[11px] font-medium text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Consistent</span>
          : null}
      >
        {mileage.points.length >= 2 ? (
          <>
            <div className="h-48 w-full" role="img" aria-label={`Mileage at each MOT, ${mileage.points.length} readings`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mileage.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(0, 4)} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(n: number) => `${Math.round(n / 1000)}k`} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString("en-GB")} mi`, "Mileage"]}
                  />
                  <Line type="monotone" dataKey="mileage" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  {mileage.decreases.map((d) => (
                    <ReferenceDot key={d.date} x={d.date} y={d.to} r={6} fill="#f59e0b" stroke="none" />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 text-xs text-muted-foreground space-y-1">
              {mileage.avgMilesPerYear != null && <li>Average ≈ {mileage.avgMilesPerYear.toLocaleString("en-GB")} miles/year between MOTs (UK average is roughly 7,000).</li>}
              {mileage.decreases.map((d) => (
                <li key={d.date} className="text-amber-400">Reading dropped from {d.from.toLocaleString("en-GB")} to {d.to.toLocaleString("en-GB")} mi on {d.date}. This can be a recording error, a replaced instrument cluster, or clocking. Ask for an explanation and paperwork.</li>
              ))}
              {mileage.enteredBelowLastMot && <li className="text-amber-400">The mileage entered is lower than the last MOT reading. Double-check the odometer.</li>}
            </ul>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {r.motSource === "dvsa" ? "Not enough MOT readings to chart (cars under 3 years old have none)." : "Live DVSA MOT history wasn't available for this report."}
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* VED */}
        <Card title="Vehicle tax (VED)" icon={Receipt} tag={<EstimateTag />}>
          {ved.annual != null ? (
            <p className="text-2xl font-semibold">{gbp(ved.annual)}<span className="text-sm text-muted-foreground font-normal"> /year</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Can't estimate</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{ved.basis}</p>
          {ved.supplementPossible && (
            <p className="text-xs text-amber-400 mt-1">Add £440/year (years 2–6) if the car's original list price was over £40,000 (or £50,000 for EVs registered from April 2025).</p>
          )}
          <a href={VED_SOURCE} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-2 hover:underline">
            GOV.UK rates from {VED_RATES_FROM} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Card>

        {/* ULEZ / CAZ */}
        <Card title="ULEZ & Clean Air Zones" icon={Wind} tag={<EstimateTag />}>
          <p className={`text-base font-semibold ${ulezStyle}`}>{ulezLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">{ulez.reason}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <a href={ULEZ_CHECKER_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">TfL vehicle checker <ExternalLink className="h-3 w-3" aria-hidden /></a>
            <a href={CAZ_CHECKER_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">Clean Air Zones (GOV.UK) <ExternalLink className="h-3 w-3" aria-hidden /></a>
          </div>
        </Card>
      </div>

      {/* Recalls */}
      <Card title="Safety recalls" icon={ShieldAlert}>
        <p className="text-xs text-muted-foreground">
          Recalls are issued against specific build batches, so the only reliable check is by this car's registration on the official DVSA service.
        </p>
        <a href="https://www.check-vehicle-recalls.service.gov.uk/" target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-3 min-h-[44px] sm:min-h-0 hover:underline">
          Check your recalls on GOV.UK <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </Card>

      {/* Advisory repair costs */}
      {latestAdvisories.length > 0 && (
        <Card title="Advisory repair costs" icon={Wrench} tag={<EstimateTag />}>
          {costs.high > 0 && (
            <p className="text-sm mb-2">Indicative total: <span className="font-semibold">{gbp(costs.low)}–{gbp(costs.high)}</span></p>
          )}
          <ul className="space-y-1.5">
            {costs.items.map((i, idx) => (
              <li key={idx} className="text-xs flex justify-between gap-3">
                <span className="text-muted-foreground">{i.text}</span>
                <span className="shrink-0 font-medium">{i.band ? `${gbp(i.band.low)}–${gbp(i.band.high)}` : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground/70 mt-2">Typical UK independent-garage ranges for parts and labour. Get a quote before you buy or sell.</p>
        </Card>
      )}

      {/* Seller checklist */}
      {!isShared && (
        <Card title="Seller checklist" icon={ListChecks}>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.item} className="text-xs flex gap-2">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${c.urgent ? "text-amber-400" : "text-primary/70"}`} aria-hidden />
                <span><span className="font-medium text-foreground">{c.item}</span> <span className="text-muted-foreground">{c.why}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AccuracyDisclaimer />
    </div>
  );
}

export { AccuracyDisclaimer };

/** Keeps an insights failure from taking down the whole report. */
export class SectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error("Insights render error:", e); captureError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}
