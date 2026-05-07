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
  Sparkles, MapPin, FileText, Tag, Star, TrendingUp, Pencil,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
            <Button asChild variant={isPremium ? "premium" : "ghost"} size="sm" title={isPremium ? "Edit valuation" : "Premium feature"}>
              <Link to={`/valuation/${v.id}/edit`}><Pencil className="h-4 w-4" />Edit</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
            <Button variant="ghost" size="sm" onClick={() => { downloadValuationPdf(v, r); toast.success("PDF downloaded"); }}><Download className="h-4 w-4" />PDF</Button>
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
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
          {/* Headline private sale price */}
          <div className="lg:col-span-3 premium-card p-5 sm:p-6 relative overflow-hidden border-primary/40 shadow-glow">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold bg-gradient-primary text-primary-foreground px-2 py-0.5 rounded-full">Best Return</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Private Sale</span>
              {r.marketConfidence && <span className="text-[9px] uppercase tracking-[0.18em] text-primary/90 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{r.marketConfidence} confidence</span>}
            </div>
            <div className="text-4xl sm:text-5xl font-bold tabular-nums text-gradient-primary leading-none">
              £{r.values.privateSale.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums mt-1.5">
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
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/60">
              <MiniTier label="Trade-in" tag="Quick" value={r.values.dealerTradeIn} />
              <MiniTier label="Retail" tag="Forecourt" value={r.values.dealerRetail} />
            </div>
          </div>

          {/* Condition score */}
          <div className="lg:col-span-2 premium-card p-5 flex flex-col items-center justify-center text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Condition Score</div>
            <ConditionGauge score={r.conditionScore} label={r.conditionLabel} size={140} />
            <p className="text-[11px] text-muted-foreground mt-3 max-w-[220px] leading-relaxed">
              Based on photos, mileage and history.
            </p>
          </div>
        </section>


        {/* Honest analysis — condensed */}
        <Section icon={<Sparkles className="h-4 w-4" />} title="Honest Analysis">
          <p className="text-sm leading-relaxed text-foreground/85">{r.honestAnalysis}</p>
          {r.photoObservations && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1.5">From your photos</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{r.photoObservations}</p>
            </div>
          )}
        </Section>

        <Section icon={<TrendingUp className="h-4 w-4" />} title="Market Positioning">
          <p className="text-sm leading-relaxed text-foreground/85">{r.marketPositioning}</p>
        </Section>

        {/* Strengths + watch points */}
        <section className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="premium-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center"><Star className="h-3.5 w-3.5" /></span>
              <h2 className="text-base font-semibold">Strengths</h2>
            </div>
            <ul className="space-y-2">
              {r.strengths.map(s => (
                <li key={s} className="flex gap-2.5 text-sm leading-snug">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="premium-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-400 grid place-items-center"><AlertTriangle className="h-3.5 w-3.5" /></span>
              <h2 className="text-base font-semibold">Watch Points</h2>
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
        <Section icon={<Tag className="h-4 w-4" />} title="Seller Recommendations">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Recommended listing price</div>
              <div className="text-4xl font-bold text-gradient-primary">£{r.recommendations.listingPrice.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Sweet spot for fast enquiries with negotiation room.</p>
            </div>
            <div>
              <RecBlock icon={<MapPin className="h-3.5 w-3.5" />} title="Where to sell" items={r.recommendations.whereToSell} />
            </div>
            <RecBlock icon={<Sparkles className="h-3.5 w-3.5" />} title="What to highlight" items={r.recommendations.highlights} />
            <RecBlock icon={<FileText className="h-3.5 w-3.5" />} title="Documents to prepare" items={r.recommendations.documents} />
          </div>
        </Section>

        {/* HPI */}
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="HPI Check Summary" right={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3 w-3" /> {r.hpi.status}
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
        <Section icon={<FileText className="h-4 w-4" />} title="MOT History">
          <ol className="relative border-l border-border ml-2">
            {r.motHistory.map((m, i) => (
              <li key={i} className="ml-6 pb-5 last:pb-0">
                <span className={cn(
                  "absolute -left-[7px] h-3.5 w-3.5 rounded-full border-2 border-background",
                  m.result === "Pass" ? "bg-primary" : m.result === "Advisory" ? "bg-amber-400" : "bg-destructive"
                )} />
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-medium text-sm">{format(new Date(m.date), "d MMMM yyyy")}</div>
                    <div className="text-xs text-muted-foreground">{m.note}</div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    <span className={cn(
                      "font-semibold mr-2",
                      m.result === "Pass" ? "text-primary" : m.result === "Advisory" ? "text-amber-400" : "text-destructive"
                    )}>{m.result}</span>
                    {m.mileage.toLocaleString()} mi
                  </div>
                </div>
              </li>
            ))}
            {r.motHistory.length === 0 && <li className="ml-6 text-sm text-muted-foreground">No prior MOT records (vehicle under 3 years old).</li>}
          </ol>
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

function MiniTier({ label, tag, value }: { label: string; tag: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80">{tag}</span>
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">£{value.toLocaleString()}</div>
    </div>
  );
}

function Section({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="premium-card p-5 sm:p-6 mb-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center">{icon}</span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function RecBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
        <span className="text-primary">{icon}</span>{title}
      </div>
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
