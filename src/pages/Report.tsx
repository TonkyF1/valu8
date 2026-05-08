import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ConditionGauge } from "@/components/ConditionGauge";
import { AdvertCreator } from "@/components/AdvertCreator";
import type { ValuationReport } from "@/lib/valuation";
import { downloadValuationPdf } from "@/lib/pdf";
import { format } from "date-fns";
import {
  Share2, Download, Bookmark, Check, ShieldCheck, AlertTriangle, ArrowLeft,
  Star, Pencil, ChevronDown,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Valuation {
  id: string; make: string; model: string; year: number; mileage: number;
  registration: string | null; mot_expiry: string | null;
  photo_urls: string[]; report: ValuationReport; created_at: string;
}

export default function Report() {
  const { id } = useParams();
  const { isPremium } = useProfile();
  const [v, setV] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showAllMot, setShowAllMot] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("valuations").select("*").eq("id", id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const photo_urls = Array.isArray(data.photo_urls) ? data.photo_urls as string[] : [];
          setV({ ...(data as any), photo_urls, report: data.report as unknown as ValuationReport });
          document.title = `${data.year} ${data.make} ${data.model} — Valu8`;
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TestModeBanner /><Header />
        <div className="flex-1 grid place-items-center"><div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /></div>
      </div>
    );
  }
  if (!v) {
    return (
      <div className="min-h-screen flex flex-col">
        <TestModeBanner /><Header />
        <div className="flex-1 grid place-items-center text-center px-4">
          <div>
            <h1 className="text-2xl font-bold">Report not found</h1>
            <Button asChild variant="hero" className="mt-6"><Link to="/dashboard">Back to dashboard</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const r = v.report;

  const share = async () => {
    try {
      await navigator.share?.({ title: `${v.year} ${v.make} ${v.model} — Valu8`, url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container py-6 md:py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> All valuations</Link>
          </Button>
          <div className="flex items-center gap-2">
            {isPremium ? (
              <Button asChild variant="ghost" size="sm" title="Edit valuation">
                <Link to={`/valuation/${v.id}/edit`}><Pencil className="h-4 w-4" />Edit</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => toast.info("Editing reports is a Premium feature")} title="Premium feature">
                <Pencil className="h-4 w-4" />Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
            {isPremium ? (
              <Button variant="ghost" size="sm" onClick={() => { downloadValuationPdf(v, r); toast.success("PDF downloaded"); }}><Download className="h-4 w-4" />PDF</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => toast.info("PDF export is a Premium feature")}><Download className="h-4 w-4" />PDF</Button>
            )}
            <Button variant="premium" size="sm" onClick={() => toast.success("Already saved to My Valuations")}><Bookmark className="h-4 w-4" />Saved</Button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6 animate-fade-in-up">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold mb-1.5">Valuation Report</div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-gradient">
            {v.year} {v.make} {v.model}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span>{v.mileage.toLocaleString()} miles</span>
            {v.registration && <><span>•</span><span className="font-mono uppercase">{v.registration}</span></>}
            <span>•</span><span>{format(new Date(v.created_at), "d MMM yyyy")}</span>
            {(r as any).edited && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                <Pencil className="h-2.5 w-2.5" /> Edited
                {(r as any).lastEditedAt && <span className="text-primary/70 normal-case font-normal">· {format(new Date((r as any).lastEditedAt), "d MMM")}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Photo gallery */}
        {v.photo_urls.length > 0 && (
          <section className="premium-card p-2 mb-4 animate-fade-in-up">
            <div className="aspect-[16/9] rounded-md overflow-hidden bg-muted">
              <img src={v.photo_urls[activePhoto]} alt={`${v.make} ${v.model}`} className="w-full h-full object-cover" />
            </div>
            {v.photo_urls.length > 1 && (
              <div className="grid grid-cols-6 gap-1 mt-1.5">
                {v.photo_urls.map((u, i) => (
                  <button key={u} onClick={() => setActivePhoto(i)}
                    className={cn(
                      "aspect-[4/3] rounded overflow-hidden border-2 transition-all",
                      activePhoto === i ? "border-primary" : "border-transparent opacity-50 hover:opacity-100"
                    )}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Hero: Private Sale headline + Condition + small tiers */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
          {/* Headline private sale price */}
          <div className="lg:col-span-3 premium-card p-5 sm:p-6 relative overflow-hidden border-primary/30">
            <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Private Sale</span>
              {r.marketConfidence && <span className="text-[9px] uppercase tracking-[0.16em] text-primary/90 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{r.marketConfidence} confidence</span>}
            </div>
            <div className="text-4xl sm:text-5xl font-semibold tabular-nums text-gradient-primary leading-none">
              <CountUp value={r.values.privateSale} prefix="£" />
            </div>
            <div className="text-xs text-muted-foreground tabular-nums mt-2">
              Range £{(r.valueRange?.privateSaleLow ?? r.values.privateSale).toLocaleString()} – £{(r.valueRange?.privateSaleHigh ?? r.values.privateSale).toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-foreground/75 leading-relaxed mt-3 max-w-md">
              The sweet spot if you sell yourself — strong return for a few weeks of effort.
            </p>
            {r.valueReasoning && (
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed mt-3 max-w-xl">
                {r.valueReasoning}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-5 pt-5 border-t border-border/60">
              <MiniTier label="Trade-in" tag="Quick" tip="What a dealer pays you today. Fastest, lowest." value={r.values.dealerTradeIn} />
              <MiniTier label="Retail" tag="Forecourt" tip="What a dealer would resell it for. Includes their margin." value={r.values.dealerRetail} />
            </div>
          </div>

          {/* Condition score */}
          <div className="lg:col-span-2 premium-card py-6 px-5 flex flex-col items-center justify-center text-center">
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-4">Condition Score</div>
            <ConditionGauge score={r.conditionScore} label={r.conditionLabel} size={100} />
            <p className="text-[11px] text-muted-foreground mt-4 max-w-[200px] leading-relaxed">
              Based on photos, mileage and history.
            </p>
          </div>
        </section>


        {/* Honest analysis — no card chrome, lighter weight */}
        <Section title="Honest Analysis">
          <p className="text-sm leading-relaxed text-foreground/85">{r.honestAnalysis}</p>
          {r.photoObservations && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-[0.16em] text-primary font-medium mb-1.5">From your photos</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{r.photoObservations}</p>
            </div>
          )}
        </Section>

        <Section title="Market Positioning">
          <p className="text-sm leading-relaxed text-foreground/85">{r.marketPositioning}</p>
        </Section>

        {/* Strengths + watch points — quieter borderless cards */}
        <section className="grid md:grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl bg-card/50 border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Strengths</h2>
            </div>
            <ul className="space-y-2">
              {r.strengths.map(s => (
                <li key={s} className="flex gap-2.5 text-sm leading-snug">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-card/50 border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Watch Points</h2>
            </div>
            <ul className="space-y-2">
              {r.watchPoints.map(s => (
                <li key={s} className="flex gap-2.5 text-sm leading-snug">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Recommendations */}
        <Section title="Seller Recommendations">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">Recommended listing price</div>
              <div className="text-4xl font-semibold text-gradient-primary tabular-nums">
                <CountUp value={r.recommendations.listingPrice} prefix="£" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Sweet spot for fast enquiries with negotiation room.</p>
            </div>
            <div>
              <RecBlock title="Where to sell" items={r.recommendations.whereToSell} />
            </div>
            <RecBlock title="What to highlight" items={r.recommendations.highlights} />
            <RecBlock title="Documents to prepare" items={r.recommendations.documents} />
          </div>
        </Section>

        {/* HPI */}
        <Section title="HPI Check Summary" right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/60 rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3 w-3 text-primary" /> {r.hpi.status} <span className="opacity-60">· Sample</span>
          </span>
        }>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {r.hpi.checks.map(c => (
              <div key={c.label} className="flex items-center gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2.5">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{c.label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* MOT history */}
        <Section title="MOT History" right={
          <span className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border",
            r.motSource === "dvsa"
              ? "text-primary bg-primary/5 border-primary/30"
              : "text-muted-foreground bg-muted/40 border-border/60"
          )}>
            {r.motSource === "dvsa" ? "Live DVSA data" : "Sample data"}
          </span>
        }>
          {r.motNotice && r.motSource !== "dvsa" && (
            <p className="text-xs text-muted-foreground mb-3">{r.motNotice}</p>
          )}
          {r.motHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior MOT records (vehicle under 3 years old).</p>
          ) : (
            <>
              <ol className={cn(
                "relative border-l border-border ml-2 transition-all",
                showAllMot && "max-h-[350px] overflow-y-auto pr-2 scrollbar-thin"
              )}>
                {(showAllMot ? r.motHistory : r.motHistory.slice(0, 5)).map((m, i) => (
                  <li key={i} className="ml-6 pb-4 last:pb-0">
                    <span className={cn(
                      "absolute -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-background",
                      m.result === "Pass" ? "bg-primary" : m.result === "Advisory" ? "bg-amber-400" : "bg-destructive"
                    )} />
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-medium text-sm">{format(new Date(m.date), "d MMMM yyyy")}</div>
                        {m.expiryDate && m.result !== "Fail" && (
                          <div className="text-[11px] text-muted-foreground">Expires {format(new Date(m.expiryDate), "d MMM yyyy")}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        <span className={cn(
                          "font-medium mr-2",
                          m.result === "Pass" ? "text-primary" : m.result === "Advisory" ? "text-amber-400" : "text-destructive"
                        )}>{m.result}</span>
                        {m.mileage > 0 && <>{m.mileage.toLocaleString()} mi</>}
                      </div>
                    </div>
                    {(m.failures?.length ?? 0) > 0 && (
                      <ul className="mt-2 space-y-1">
                        {m.failures!.map((f, k) => (
                          <li key={k} className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-2.5 py-1.5">
                            <span className="font-medium">Failure:</span> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(m.advisories?.length ?? 0) > 0 && (
                      <ul className="mt-2 space-y-1">
                        {m.advisories!.map((a, k) => (
                          <li key={k} className="text-xs text-amber-700 dark:text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-md px-2.5 py-1.5">
                            <span className="font-medium">Advisory:</span> {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(!m.advisories || m.advisories.length === 0) && (!m.failures || m.failures.length === 0) && m.note && (
                      <div className="text-xs text-muted-foreground mt-1">{m.note}</div>
                    )}
                  </li>
                ))}
              </ol>
              {r.motHistory.length > 5 && (
                <button
                  onClick={() => setShowAllMot(s => !s)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg hover:bg-muted/30"
                >
                  {showAllMot ? "Show less" : `Show full MOT history (${r.motHistory.length - 5} more)`}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllMot && "rotate-180")} />
                </button>
              )}
            </>
          )}
        </Section>

        <AdvertCreator
          valuationId={v.id}
          vehicle={{ make: v.make, model: v.model, year: v.year, mileage: v.mileage, registration: v.registration, mot_expiry: v.mot_expiry }}
          report={{
            recommendations: { listingPrice: r.recommendations.listingPrice, highlights: r.recommendations.highlights },
            conditionScore: r.conditionScore,
            conditionLabel: r.conditionLabel,
            honestAnalysis: r.honestAnalysis,
            strengths: r.strengths,
          }}
          initialAdvert={(r as any).advert ?? null}
        />

        <footer className="mt-10 pt-8 border-t border-border text-xs text-muted-foreground space-y-2">
          <p><strong className="text-foreground/80">Data sources:</strong> UK retail and trade pricing benchmarks, DVLA-style MOT/HPI summaries, Valu8 condition modelling.</p>
          <p><strong className="text-foreground/80">Disclaimer:</strong> Valuations are AI-generated estimates for guidance only and do not constitute financial advice or a guaranteed sale price. Always verify HPI and MOT data through official sources before transacting.</p>
        </footer>
      </main>
      <Footer />
    </div>
  );
}

function MiniTier({ label, tag, tip, value }: { label: string; tag: string; tip?: string; value: number }) {
  const inner = (
    <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5 transition-colors hover:border-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{tag}</span>
      </div>
      <div className="text-lg font-medium tabular-nums mt-0.5">£{value.toLocaleString()}</div>
    </div>
  );
  if (!tip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild><div className="cursor-help">{inner}</div></TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
        {right}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/50 p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function RecBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-3 font-medium">{title}</div>
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i} className="flex gap-2 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
