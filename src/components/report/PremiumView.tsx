import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { AlertTriangle, ChevronDown, Download, Share2 } from "lucide-react";
import type { ValuationReport } from "@/lib/valuation";
import type { Intent } from "@/lib/intent";
import { askingFor, saveAskingFor } from "@/lib/intent";
import { IntentSwitch } from "@/components/IntentSwitch";
import { FitPrice } from "@/components/FitPrice";
import { normaliseReportPricing, displayPrivateRange, hasPhotos } from "@/lib/askingPrice";
import { buyerGuide, buyerChecks, compareAsking, diffLine, parseAsking, VERDICT_COPY } from "@/lib/buyerGuide";
import { VehicleInsights, SectionBoundary } from "@/components/VehicleInsights";
import { MotHistoryByYear } from "@/components/report/MotHistoryByYear";
import { tierText, type ConfidenceTier } from "@/components/report/ConfidenceCard";
import { cn } from "@/lib/utils";
import { rangeReasonCopy } from "../../../supabase/functions/_shared/cheapRange";
import { reportRef, sellerPlan } from "@/lib/premiumPlan";

export const PREMIUM_SECTIONS = [
  { id: "p-price", label: "Price" },
  { id: "p-plan", label: "Plan" },
  { id: "p-why", label: "Why" },
  { id: "p-comps", label: "Adverts" },
  { id: "p-mot", label: "MOT" },
  { id: "p-mileage", label: "Mileage" },
  { id: "p-running", label: "Tax & ULEZ" },
  { id: "p-photos", label: "Photos" },
  { id: "p-checklist", label: "Checklist" },
  { id: "p-advert", label: "Advert" },
] as const;

const gbp = (n?: number | null) => (typeof n === "number" && isFinite(n) && n > 0 ? `£${Math.round(n).toLocaleString("en-GB")}` : "–");

export { reportRef, sellerPlan };

export interface PremiumVehicle {
  id: string; make: string; model: string; year: number; mileage: number; registration: string | null;
  mot_expiry?: string | null; photo_urls: string[]; created_at: string; service_notes?: string | null;
}

interface Props {
  v: PremiumVehicle;
  r: ValuationReport;
  title: string;
  intent: Intent;
  onIntent: (i: Intent) => void;
  tier: ConfidenceTier;
  motExpired: Date | null;
  motExpiredPct?: number | null;
  movers: ReactNode;
  confidence: ReactNode;
  advert?: ReactNode;
  extras?: ReactNode;
  isShared?: boolean;
  onPdf: () => void;
  onShare?: () => void;
  onSelectPhoto: (i: number) => void;
  onOpenLightbox: (i: number) => void;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-130px 0px -60% 0px" });
    key.split(",").forEach((id) => { const el = id && document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [key]);
  return active;
}

function Section({ id, kicker, title, children, className }: { id: string; kicker?: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-32 lg:scroll-mt-24 pt-9", className)}>
      {kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FA3A1]">{kicker}</p>}
      <h2 id={`${id}-h`} className="mt-1 text-2xl sm:text-[28px] font-light tracking-tight text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, accent, testId }: { label: string; value: string; accent?: boolean; testId?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl p-4 border", accent ? "border-[#00D6C8]/40 bg-[#00D6C8]/[0.08]" : "border-white/10 bg-white/[0.03]")}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-[#5EF2E6]" : "text-[#B4B4B4]")}>{label}</p>
      <FitPrice text={value} align="left" allowSplit={false} floorPx={14} boxClassName="mt-1" testId={testId}
        className="text-[28px] sm:text-[32px] font-light tabular-nums tracking-tight text-white" style={{ display: "inline-block" }} />
    </div>
  );
}

/** Premium Report (paid): one dark page, each price shown once, sticky section nav. */
export function PremiumView(props: Props) {
  const { v, r, title, intent, onIntent, tier, motExpired, motExpiredPct, isShared } = props;
  const buying = intent === "buying";
  const p = normaliseReportPricing(r);
  const range = displayPrivateRange(r);
  const plan = sellerPlan(r);
  const [askText, setAskText] = useState(() => { const a = askingFor(v.id); return a ? a.toLocaleString("en-GB") : ""; });
  const asking = parseAsking(askText);
  const [advertOpen, setAdvertOpen] = useState(() => typeof window !== "undefined" && window.location.hash === "#p-advert");
  useEffect(() => { if (buying) saveAskingFor(v.id, asking); }, [buying, v.id, asking]);
  const guide = useMemo(() => buyerGuide({ privateSale: p.privateSale, privateLow: p.privateLow, privateHigh: p.privateHigh, tradeIn: p.tradeIn, retail: p.retail }, asking), [p.privateSale, p.privateLow, p.privateHigh, p.tradeIn, p.retail, asking]);
  const cmp = guide && asking ? compareAsking(asking, guide) : null;
  const comps = (r.comparableListings ?? []).filter((c) => c && c.price > 0).slice(0, 8);
  const photos = hasPhotos(v.photo_urls) && (r.photoInsights?.length ?? 0) > 0;
  const showAdvert = !buying && !isShared && !!props.advert;
  const latestAdv = r.motSource === "dvsa" ? r.motHistory?.[0]?.advisories?.length ?? 0 : 0;
  const vehicle = { make: v.make, model: v.model, year: v.year, mileage: v.mileage, mot_expiry: v.mot_expiry, service_notes: v.service_notes ?? null };

  const sections = PREMIUM_SECTIONS.filter((s) =>
    (s.id !== "p-comps" || comps.length > 0) && (s.id !== "p-photos" || photos) && (s.id !== "p-advert" || showAdvert));
  const active = useActiveSection(sections.map((s) => s.id));
  const span = Math.max(1, p.retail - p.tradeIn);
  const pos = Math.min(100, Math.max(0, ((p.privateSale - p.tradeIn) / span) * 100));

  const nav = (variant: "chips" | "rail") => (
    <nav aria-label="Report sections" className={variant === "chips" ? "flex gap-1.5 overflow-x-auto no-scrollbar" : "flex flex-col gap-0.5"}>
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}
          className={cn(variant === "chips"
            ? "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors min-h-[32px] inline-flex items-center"
            : "rounded-lg px-3 py-2 text-sm transition-colors",
            active === s.id
              ? (variant === "chips" ? "border-[#00D6C8]/50 bg-[#00D6C8]/10 text-white" : "bg-white/[0.06] text-white")
              : (variant === "chips" ? "border-white/10 text-[#C8C8C8] hover:text-white" : "text-[#B4B4B4] hover:text-white"))}>
          {s.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div data-testid="premium-view" className="text-white">
      {/* Phones and tablets: sticky section chips under the site header. */}
      <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4 py-2.5 mb-6 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10" data-testid="premium-nav">
        {nav("chips")}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <div className="min-w-0">
          {/* Hero: the precise private figure first; the range is secondary. */}
          <section id="p-price" aria-labelledby="p-price-h" className="scroll-mt-32 lg:scroll-mt-24 relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(0,214,200,0.12),transparent_55%),#0B0B0B] px-5 py-6 sm:px-8 sm:py-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full border border-[#00D6C8]/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5EF2E6]">Premium Report</span>
                {v.registration && <span className="rounded bg-[#FFD500] px-2 py-0.5 text-sm font-bold tracking-wider text-[#111]">{v.registration.toUpperCase()}</span>}
              </div>
              {!isShared && <IntentSwitch size="xs" where="report" value={intent} onChange={onIntent} />}
            </div>
            <h1 id="p-price-h" className="mt-5 text-[22px] sm:text-3xl font-light tracking-tight text-white">{title}</h1>
            <p className="mt-1 text-sm text-[#B4B4B4]">
              {v.mileage.toLocaleString("en-GB")} miles · {format(new Date(v.created_at), "d MMM yyyy")} · Ref {reportRef(v.id)}
            </p>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4B4B4]">{buying ? "Fair price · private sale" : "Private sale value"}</p>
            <FitPrice text={gbp(p.privateSale)} align="left" allowSplit={false} floorPx={28} boxClassName="mt-1" testId="premium-price"
              className="text-[64px] sm:text-[88px] leading-[0.95] font-extralight tabular-nums tracking-tight text-white" style={{ display: "inline-block", fontFamily: "Sora, Inter, sans-serif" }} />
            <p className="mt-3 text-sm text-[#C8C8C8]" data-testid="premium-range">
              Likely range {range.text} · <span className="text-white">{tierText(tier)} confidence</span>
            </p>
            {range.headline && <p className="mt-1 text-xs text-[#A8A8A8] max-w-[52ch]" data-testid="premium-range-why">{rangeReasonCopy(range.headline)}</p>}

            <div className="mt-6 max-w-md">
              <div className="relative h-1 rounded-full bg-white/15" aria-hidden>
                <div className="absolute -top-[5px] h-3.5 w-3.5 rounded-full bg-[#00D6C8] shadow-[0_0_14px_rgba(0,214,200,0.7)]" style={{ left: `calc(${pos}% - 7px)` }} />
              </div>
              <div className="mt-2.5 flex justify-between text-xs text-[#B4B4B4]">
                <span>Part-exchange {gbp(p.tradeIn)}</span><span>Dealer retail {gbp(p.retail)}</span>
              </div>
            </div>

            {motExpired && (
              <div role="note" data-testid="mot-expired-callout" className="mt-6 flex gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" aria-hidden />
                <span>MOT expired {format(motExpired, "d MMM yyyy")}.{motExpiredPct != null ? ` That takes about ${Math.abs(Math.round(motExpiredPct))}% off.` : ""} A fresh MOT usually wins most of it back.</span>
              </div>
            )}
          </section>

          {/* Plan */}
          {buying ? (
            <Section id="p-plan" kicker="Your buying plan" title="What to offer">
              {guide && (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Opening offer" value={gbp(guide.openingOffer)} accent testId="plan-opening" />
                  <Stat label="Aim to agree" value={`${gbp(guide.rangeLow)} – ${gbp(guide.rangeHigh)}`} testId="plan-range" />
                </div>
              )}
              <label htmlFor="pv-asking" className="mt-5 block text-sm font-medium text-white">Advertised asking price</label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 focus-within:border-[#00D6C8]">
                <span className="text-[#B4B4B4]">£</span>
                <input id="pv-asking" data-testid="report-asking" inputMode="numeric" placeholder="e.g. 8,495" value={askText}
                  onChange={(e) => setAskText(e.target.value.replace(/[^\d,]/g, ""))}
                  className="min-h-[46px] w-full bg-transparent text-base text-white outline-none tabular-nums placeholder:text-[#8A8A8A]" />
              </div>
              {cmp ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4" data-testid="asking-compare">
                  <p className="text-sm"><span className="font-semibold text-white">{VERDICT_COPY[cmp.verdict].label}</span> <span className="text-[#B4B4B4]">· {diffLine(cmp)}</span></p>
                  <p className="mt-1 text-sm text-[#C8C8C8]">{VERDICT_COPY[cmp.verdict].tip}</p>
                </div>
              ) : <p className="mt-1.5 text-xs text-[#B4B4B4]">Optional. Add the price from the advert to see how it compares.</p>}
            </Section>
          ) : (
            <Section id="p-plan" kicker="Your selling plan" title="What to ask, and what to accept">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Advertise at" value={gbp(plan.advertise)} accent testId="plan-advertise" />
                <Stat label="Lowest offer to accept" value={gbp(plan.lowest)} testId="plan-lowest" />
              </div>
              <ol className="mt-4 space-y-2 text-sm text-[#D0D0D0]">
                <li><span className="text-[#5EF2E6] mr-2">1</span>Advertise at the higher figure. That leaves about {gbp(plan.room)} to negotiate.</li>
                <li><span className="text-[#5EF2E6] mr-2">2</span>Hold firm on anything at or above your lowest offer. Below it, a part-exchange may be easier.</li>
                <li><span className="text-[#5EF2E6] mr-2">3</span>{motExpired ? "Get a fresh MOT before you list: buyers pay noticeably less without one." : latestAdv > 0 ? "Have answers ready on the MOT advisories below. Buyers will ask." : "Lead with the clean MOT record and the service history."}</li>
              </ol>
            </Section>
          )}

          <Section id="p-why" kicker="Behind the number" title="Why this price">
            <div className="grid gap-4 md:grid-cols-2 md:items-start [&>*]:mb-0">{props.movers}{props.confidence}</div>
          </Section>

          {comps.length > 0 && (
            <Section id="p-comps" kicker="The market" title={`${comps.length} UK adverts we compared`}>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <caption className="sr-only">Comparable UK adverts</caption>
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[#B4B4B4]"><th scope="col" className="px-4 py-2.5 font-medium">Car</th><th scope="col" className="px-4 py-2.5 font-medium">Miles</th><th scope="col" className="px-4 py-2.5 text-right font-medium">Asking</th></tr></thead>
                  <tbody>
                    {comps.map((c, i) => (
                      <tr key={i} className="border-t border-white/[0.07]">
                        <td className="px-4 py-2.5 text-white">{c.year}{c.trim ? ` ${c.trim}` : ""}</td>
                        <td className="px-4 py-2.5 tabular-nums text-[#C8C8C8]">{c.mileage ? c.mileage.toLocaleString("en-GB") : "–"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-white">{gbp(c.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-[#B4B4B4]">Advertised prices. Cars usually sell for a little less than they're advertised at.</p>
            </Section>
          )}

          <Section id="p-mot" kicker="Official DVSA record" title="MOT and advisories">
            <div className="space-y-4">
              <SectionBoundary><VehicleInsights report={r} vehicle={vehicle} isShared={isShared} parts={["advisories"]} /></SectionBoundary>
              {r.motHistory?.length ? (
                <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
                  <summary className="cursor-pointer list-none px-4 py-3.5 text-sm text-white flex items-center justify-between min-h-[48px]">
                    <span>Full MOT history · {r.motHistory.length} {r.motHistory.length === 1 ? "test" : "tests"}</span>
                    <span className="text-[#5EF2E6] text-xs group-open:hidden">Show</span><span className="text-[#5EF2E6] text-xs hidden group-open:inline">Hide</span>
                  </summary>
                  <div className="px-3 pb-3"><MotHistoryByYear history={r.motHistory} idPrefix="pmot" /></div>
                </details>
              ) : <p className="text-sm text-[#B4B4B4]">No MOT records yet (cars under 3 years old have none).</p>}
            </div>
          </Section>

          <Section id="p-mileage" kicker="Clocking check" title="Mileage">
            <SectionBoundary><VehicleInsights report={r} vehicle={vehicle} isShared={isShared} parts={["mileage"]} /></SectionBoundary>
          </Section>

          <Section id="p-running" kicker="Running costs" title="Tax, ULEZ and recalls">
            <SectionBoundary><VehicleInsights report={r} vehicle={vehicle} isShared={isShared} parts={["running"]} /></SectionBoundary>
          </Section>

          {photos && (
            <Section id="p-photos" kicker="Condition" title="What your photos show">
              {r.conditionLabel && <p className="-mt-2 mb-4 text-sm text-[#C8C8C8]">Condition: <span className="text-white">{r.conditionLabel}</span>{r.conditionScore ? ` · ${r.conditionScore}/10` : ""}</p>}
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {v.photo_urls.slice(0, 6).map((u, i) => {
                  const ins = (r.photoInsights ?? []).filter((x) => x.photoIndex === i);
                  const note = ins.find((x) => (x.priceImpact ?? 0) < 0) ?? ins[0];
                  return (
                    <li key={u} className="min-w-0">
                      <button type="button" onClick={() => { props.onSelectPhoto(i); props.onOpenLightbox(i); }} className="block w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] aspect-[4/3]" aria-label={`Open photo ${i + 1}`}>
                        <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                      {note?.observation && <p className="mt-1.5 text-xs leading-snug text-[#C8C8C8] line-clamp-3">{note.observation}</p>}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section id="p-checklist" kicker={buying ? "Before you buy" : "Before you sell"} title="Checklist">
            {buying ? (
              <ul className="space-y-2.5 text-sm text-[#D0D0D0]">
                {[...buyerChecks(r.watchPoints), "Check the V5C logbook matches the seller and the car.", "Check the service history supports the mileage on the MOT record.", "Check for outstanding safety recalls on GOV.UK."].map((t) => (
                  <li key={t} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D6C8]" />{t}</li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                {[["What to highlight", r.recommendations?.highlights], ["Documents to have ready", r.recommendations?.documents], ["Where to sell", r.recommendations?.whereToSell]]
                  .filter(([, l]) => Array.isArray(l) && l.length)
                  .map(([t, l], i) => (
                    <details key={t as string} open={i === 0} className="group rounded-2xl border border-white/10 bg-white/[0.02]">
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] text-sm font-medium text-white">
                        <span>{t as string} <span className="text-[#9A9A9A] font-normal">· {(l as string[]).length}</span></span>
                        <ChevronDown aria-hidden className="h-4 w-4 text-[#8A8A8A] transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="px-4 pb-4 space-y-1.5 text-sm text-[#C8C8C8]">{(l as string[]).slice(0, 6).map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#00D6C8]" />{x}</li>)}</ul>
                    </details>
                  ))}
                {!isShared && (
                  <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] text-sm font-medium text-white">
                      <span>Step-by-step seller checklist</span>
                      <ChevronDown aria-hidden className="h-4 w-4 text-[#8A8A8A] transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-2 pb-2"><SectionBoundary><VehicleInsights report={r} vehicle={vehicle} isShared={isShared} parts={["checklist"]} /></SectionBoundary></div>
                  </details>
                )}
              </div>
            )}
          </Section>

          {showAdvert && (
            <Section id="p-advert" kicker="Ready to post" title="Your advert">
              <details className="group rounded-2xl border border-[#00D6C8]/30 bg-[#00D6C8]/[0.04]" open={advertOpen} onToggle={(e) => setAdvertOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px]">
                  <span className="text-sm text-white"><span className="font-medium">Write my advert</span><span className="block text-xs text-[#B4B4B4] mt-0.5">Short, medium or full text, formatted for each site</span></span>
                  <ChevronDown aria-hidden className="h-4 w-4 text-[#5EF2E6] transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-2 pb-2">{props.advert}</div>
              </details>
            </Section>
          )}

          {props.extras && <div className="pt-10 space-y-4">{props.extras}</div>}
        </div>

        {/* Desktop rail: sections and actions stay in view. */}
        <aside className="hidden lg:block" aria-label="Report tools">
          <div className="sticky top-24 space-y-6">
            <div>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FA3A1]">On this report</p>
              <div className="mt-2">{nav("rail")}</div>
            </div>
            <div className="space-y-2 px-3">
              <button type="button" onClick={props.onPdf} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#00D6C8] px-4 py-2.5 text-sm font-semibold text-[#041312] hover:bg-[#1AFFF0] transition-colors">
                <Download className="h-4 w-4" aria-hidden /> Download PDF
              </button>
              {props.onShare && (
                <button type="button" onClick={props.onShare} className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors">
                  <Share2 className="h-4 w-4" aria-hidden /> Share
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
