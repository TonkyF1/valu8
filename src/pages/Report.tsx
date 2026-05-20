import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ConditionGauge } from "@/components/ConditionGauge";
import { AdvertCreator } from "@/components/AdvertCreator";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { SimilarCars } from "@/components/SimilarCars";
import type { ValuationReport, PhotoInsight } from "@/lib/valuation";
import { downloadValuationPdf } from "@/lib/pdf";
import { format } from "date-fns";
import {
  Share2, Download, Bookmark, Check, ShieldCheck, AlertTriangle, ArrowLeft,
  Star, Pencil, ChevronDown, MoreHorizontal, Sparkles, Camera, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";
import { ValuationTrendChart } from "@/components/ValuationTrendChart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface Valuation {
  id: string; make: string; model: string; year: number; mileage: number;
  registration: string | null; mot_expiry: string | null;
  photo_urls: string[]; report: ValuationReport; created_at: string;
}

export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPremium } = useProfile();
  const [v, setV] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showAllMot, setShowAllMot] = useState(false);
  const [showOldAdvisories, setShowOldAdvisories] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);

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

  useEffect(() => {
    if (!v) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    supabase.functions
      .invoke("marketcheck-count", {
        body: { make: v.make, model: v.model, year: v.year },
        // @ts-ignore - method query workaround
      })
      .then(({ data, error }) => {
        if (error) return;
        const n = Number((data as any)?.totalCount);
        if (Number.isFinite(n)) setLiveCount(n);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [v]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TestModeBanner /><Header />
        <main className="flex-1 container py-6 md:py-8 max-w-5xl">
          <div className="flex items-center justify-between mb-5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-3 mb-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="aspect-[16/9] w-full rounded-2xl mb-4" />
          <div className="grid lg:grid-cols-5 gap-3 mb-6">
            <Skeleton className="lg:col-span-3 h-56 rounded-2xl" />
            <Skeleton className="lg:col-span-2 h-56 rounded-2xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl mb-4" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </main>
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
  const valuationUnavailable = !!r.valuationUnavailable;

  // Live market confidence derived from MarketCheck total count.
  // If API fails/pending -> liveCount is null. Default to LOW silently.
  const liveTier: "High" | "Medium" | "Low" =
    liveCount == null ? "Low"
    : liveCount >= 500 ? "High"
    : liveCount >= 150 ? "Medium"
    : "Low";
  const liveConfidenceLine =
    liveTier === "High"
      ? "Priced using a deep pool of live UK listings — this is a well-supported valuation."
      : liveTier === "Medium"
      ? "Based on a healthy sample of similar cars on the market right now."
      : "Fewer similar cars are listed right now, so treat this as a strong estimate rather than a precise figure.";

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
            <Button
              variant="premium"
              size="sm"
              onClick={() => {
                if (!isPremium) return toast.info("PDF export is a Premium feature");
                downloadValuationPdf(v, r);
                toast.success("PDF downloaded");
              }}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => {
                    if (isPremium) navigate(`/valuation/${v.id}/edit`);
                    else toast.info("Editing reports is a Premium feature");
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit valuation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={share}>
                  <Share2 className="h-4 w-4" /> Share link
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-70">
                  <Bookmark className="h-4 w-4" /> Saved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{valuationUnavailable ? "Valuation status" : "Your Realistic Private Sale Price"}</span>
              <span className={cn(
                "text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border",
                liveTier === "High" && "text-primary bg-primary/10 border-primary/30",
                liveTier === "Medium" && "text-amber-400 bg-amber-500/10 border-amber-500/30",
                liveTier === "Low" && "text-red-400 bg-red-500/10 border-red-500/30",
              )}>
                {liveTier} confidence
              </span>
            </div>
            {valuationUnavailable ? (
              <div className="max-w-xl">
                <div className="text-2xl sm:text-3xl font-semibold leading-tight text-foreground">
                  Unable to value accurately
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  {r.valueReasoning || r.honestAnalysis}
                </p>
              </div>
            ) : (
              <>
                <div className="text-4xl sm:text-5xl font-semibold tabular-nums text-gradient-primary leading-none">
                  <CountUp value={r.values.privateSale} prefix="£" />
                </div>
                <p className="text-sm text-muted-foreground mt-2 max-w-[44ch]">
                  This is what you can realistically expect to sell for privately in the current UK market.
                </p>
                {liveCount != null && liveCount > 0 && (
                  <div className="text-xs text-muted-foreground/80 mt-1">
                    Based on {liveCount.toLocaleString()} similar cars listed in the UK right now
                  </div>
                )}
              </>
            )}
            {r.rareCarWarning && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] sm:text-xs text-amber-200/90 leading-relaxed">
                <span className="font-medium text-amber-300">Limited data:</span> {r.rareCarWarning}
              </div>
            )}
            {!valuationUnavailable && (
              <ValuationTrendChart
                currentValue={r.values.privateSale}
                registrationYear={v.year}
                make={v.make}
                model={v.model}
              />
            )}
            {valuationUnavailable ? (
              <p className="text-sm sm:text-base leading-[1.65] text-[#E8E8E8] mt-4 max-w-[44ch]">
                We'd rather be honest than give you a number that could be way off.
              </p>
            ) : (
              <div className="mt-4 space-y-3 max-w-[44ch]">
                {/* Paragraph 1 — AI headline or fallback */}
                <p className="text-sm sm:text-base leading-[1.65] text-[#E8E8E8]">
                  {r.headline ? (
                    r.headline
                  ) : (
                    <>
                      <span className="tabular-nums font-medium">£{r.values.privateSale.toLocaleString()}</span>
                      {" "}is a strong asking price for a {v.year} {v.make} {v.model} in today's private market — realistic enough to attract serious buyers quickly, without leaving money on the table.
                    </>
                  )}
                </p>

                {/* Paragraph 2 — market context from AI or live confidence */}
                <p className="text-sm leading-[1.65] text-[#E8E8E8]/85">
                  {r.marketContext || liveConfidenceLine}
                </p>

                {/* Paragraph 3 — factors affecting price (AI-driven, fall back to deterministic) */}
                {(() => {
                  const positives = (r.factorsUp && r.factorsUp.length > 0)
                    ? r.factorsUp
                    : (r.priceAdjustments?.filter(a => a.impactPct > 0).map(a => a.label) ?? []);
                  const negatives = (r.factorsDown && r.factorsDown.length > 0)
                    ? r.factorsDown
                    : (r.priceAdjustments?.filter(a => a.impactPct < 0).map(a => a.label) ?? []);
                  if (positives.length === 0 && negatives.length === 0) {
                    return r.valueReasoning ? (
                      <p className="text-sm leading-[1.65] text-[#E8E8E8]/85">{r.valueReasoning}</p>
                    ) : null;
                  }
                  const join = (arr: string[]) =>
                    arr.length <= 1 ? (arr[0] ?? "") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
                  return (
                    <p className="text-sm leading-[1.65] text-[#E8E8E8]/85">
                      {positives.length > 0 && <>{join(positives)} {positives.length > 1 ? "all push" : "pushes"} the value up. </>}
                      {negatives.length > 0 && <>We've nudged it down to account for {join(negatives)} — buyers will likely use these to negotiate.</>}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Suggested Asking Price — range with honest context */}
            {!valuationUnavailable && (
              <div className="mt-5 rounded-xl border border-primary/30 bg-primary/[0.05] px-4 py-3.5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary/90 font-medium mb-1">Suggested Asking Price</div>
                {(() => {
                  const base = r.recommendedAskingPrice || r.recommendations?.recommendedAskingPrice || r.recommendations.listingPrice || Math.round(r.values.privateSale * 1.04 / 50) * 50;
                  const rangeLow = Math.round((base - 250) / 50) * 50;
                  const rangeHigh = Math.round((base + 250) / 50) * 50;
                  const buffer = r.negotiationBuffer || r.recommendations?.negotiationBuffer || Math.round(base * 0.04 / 50) * 50;
                  const marketLow = r.valueRange?.privateSaleLow ?? Math.round(r.values.privateSale * 0.95 / 50) * 50;
                  const marketHigh = r.valueRange?.privateSaleHigh ?? Math.round(r.values.privateSale * 1.08 / 50) * 50;
                  return (
                    <>
                      <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-foreground leading-none">
                        £{rangeLow.toLocaleString()} – £{rangeHigh.toLocaleString()}
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed max-w-[44ch]">
                        List in this range to attract serious buyers while leaving £{buffer.toLocaleString()}–£{Math.round(buffer * 1.35 / 50) * 50} room to negotiate. Most similar cars are currently selling between £{marketLow.toLocaleString()} – £{marketHigh.toLocaleString()}.
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Pro Tip — negotiation guidance */}
            {!valuationUnavailable && (
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3 flex gap-2.5">
                <span className="text-amber-300 mt-0.5 leading-none" aria-hidden>💡</span>
                {(() => {
                  const base = r.recommendedAskingPrice || r.recommendations?.recommendedAskingPrice || r.recommendations.listingPrice || Math.round(r.values.privateSale * 1.04 / 50) * 50;
                  const listAt = Math.round((base * 1.03) / 50) * 50;
                  const buffer = r.negotiationBuffer || r.recommendations?.negotiationBuffer || Math.round(base * 0.04 / 50) * 50;
                  const offerLow = Math.max(r.values.privateSale, Math.round((listAt - buffer * 1.3) / 50) * 50);
                  const offerHigh = Math.max(r.values.privateSale, Math.round((listAt - buffer * 0.7) / 50) * 50);
                  return (
                    <p className="text-[13px] leading-[1.55] text-[#E8E8E8]">
                      <span className="font-semibold text-amber-300">Pro Tip:</span> List at £{listAt.toLocaleString()} and expect offers around £{offerLow.toLocaleString()}–£{offerHigh.toLocaleString()}. {r.strengths.some(s => /full service history|fsh|main dealer/i.test(s)) ? "Your full service history is a strong selling point." : "Highlight your car's strengths when negotiating."}
                    </p>
                  );
                })()}
              </div>
            )}

            {!valuationUnavailable && liveCount == null && (
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Valued using AI market analysis — fewer live comparables available for this model right now.
              </p>
            )}
            {!valuationUnavailable && r.comparableListings && r.comparableListings.length > 0 && (
              <div className="mt-4 max-w-xl">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 mb-2">
                  Live listings used to anchor this price
                </div>
                <ul className="space-y-1.5">
                  {r.comparableListings.slice(0, 3).map((l, i) => {
                    const inner = (
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-foreground/80 truncate">
                          {l.year} · {l.mileage.toLocaleString()} mi{l.trim ? ` · ${l.trim}` : ""}{l.location ? ` · ${l.location}` : ""}
                        </span>
                        <span className="tabular-nums font-medium text-foreground/95 shrink-0">£{l.price.toLocaleString()}</span>
                      </div>
                    );
                    return (
                      <li key={i} className="rounded-md border border-border/40 bg-card/40 px-3 py-2 hover:border-border/70 transition-colors">
                        {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer">{inner}</a> : inner}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Real active UK listings (MarketCheck). Closest to your car's mileage.
                </p>
              </div>
            )}
            {!valuationUnavailable && (
              <div className="grid grid-cols-2 gap-2 mt-5 pt-5 border-t border-border/60">
                <MiniTier label="Trade-in" tag="Quick" tip="What a dealer pays you today. Fastest, lowest." value={r.values.dealerTradeIn} />
                <MiniTier label="Retail" tag="Forecourt" tip="What a dealer would resell it for. Includes their margin." value={r.values.dealerRetail} />
              </div>
            )}
          </div>

          {/* Condition score / specialist guidance */}
          <div className="lg:col-span-2 premium-card py-6 px-5 flex flex-col items-center justify-center text-center">
            {valuationUnavailable ? (
              <>
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-4">Recommended route</div>
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300">
                  Specialist / auction
                </div>
                <p className="text-[11px] text-muted-foreground mt-4 max-w-[220px] leading-relaxed">
                  Cars like this are too rare for our system to value accurately. A specialist dealer or auction house will give you a much better idea.
                </p>
              </>
            ) : (
              <>
                <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-4">Condition Score</div>
                <div className="w-full max-w-[280px]">
                  <ConditionGauge score={r.conditionScore} label={r.conditionLabel} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-4 max-w-[200px] leading-relaxed">
                  Based on photos, mileage and history.
                </p>
              </>
            )}
          </div>
        </section>


        {/* Honest analysis — no card chrome, lighter weight */}
        <Section title="Honest Analysis">
          <p className="text-sm leading-relaxed text-foreground/85">{r.honestAnalysis}</p>
          {r.photoObservations && (!r.photoInsights || r.photoInsights.length === 0) && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-[0.16em] text-primary font-medium mb-1.5">From your photos</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{r.photoObservations}</p>
            </div>
          )}
        </Section>

        {/* Per-photo AI feedback — our moat made visible */}
        {r.photoInsights && r.photoInsights.length > 0 && v.photo_urls.length > 0 && (
          <PhotoFeedback insights={r.photoInsights} photoUrls={v.photo_urls} onSelectPhoto={setActivePhoto} />
        )}

        {/* What If Simulator — toggle fixable issues to see the upside */}
        {!valuationUnavailable && r.photoInsights && r.photoInsights.length > 0 && (
          <WhatIfSimulator
            insights={r.photoInsights}
            privateSale={r.values.privateSale}
            recommendedAskingPrice={
              r.recommendedAskingPrice ||
              r.recommendations?.recommendedAskingPrice ||
              r.recommendations.listingPrice
            }
            negotiationBuffer={r.negotiationBuffer || r.recommendations?.negotiationBuffer}
          />
        )}


        {!valuationUnavailable && (
          <Section title="Market Positioning">
            <p className="text-sm leading-relaxed text-foreground/85">{r.marketPositioning}</p>
          </Section>
        )}

        {/* Strengths + watch points — quieter borderless cards */}
        {!valuationUnavailable && (
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
              {(() => {
                const latestMot = r.motHistory?.[0];
                const currentAdvisories = latestMot?.advisories ?? [];
                if (currentAdvisories.length === 0) {
                  return (
                    <div className="flex items-start gap-2.5 text-sm leading-snug">
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-emerald-300">No advisories on the latest MOT</span>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <p className="text-[11px] text-muted-foreground">These are from the most recent MOT only</p>
                    <ul className="space-y-2">
                      {currentAdvisories.map((a, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-snug">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {!valuationUnavailable && (
          <Section title="Seller Recommendations">
            <div className="grid md:grid-cols-2 gap-6">
              <RecBlock title="Where to sell" items={r.recommendations.whereToSell} />
              <RecBlock title="What to highlight" items={r.recommendations.highlights} />
              <RecBlock title="Documents to prepare" items={r.recommendations.documents} />
            </div>
          </Section>
        )}

        {/* HPI */}
        <Section title="HPI Check Summary" right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/60 rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3 w-3 text-primary" /> {r.hpi.status}
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
          r.motSource === "dvsa" ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border text-primary bg-primary/5 border-primary/30">
              Live DVSA data
            </span>
          ) : null
        }>
          {r.motNotice && r.motSource !== "dvsa" && (
            <p className="text-xs text-muted-foreground mb-3">{r.motNotice}</p>
          )}
          {r.motHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior MOT records (vehicle under 3 years old).</p>
          ) : (
            <>
              <ol className="space-y-3">
                {(showAllMot ? r.motHistory : r.motHistory.slice(0, 1)).map((m, i) => (
                  <li key={i} className={cn(i > 0 && "pt-3 border-t border-border/40")}>
                    <div className="flex items-baseline justify-between flex-wrap gap-x-3 gap-y-1">
                      <div className="flex items-baseline gap-2.5">
                        <span className={cn(
                          "text-[11px] font-semibold uppercase tracking-wider",
                          m.result === "Pass" ? "text-primary" : m.result === "Advisory" ? "text-amber-400" : "text-destructive"
                        )}>{m.result}</span>
                        <span className="font-medium text-sm">{format(new Date(m.date), "d MMM yyyy")}</span>
                        {m.expiryDate && m.result !== "Fail" && (
                          <span className="text-[11px] text-muted-foreground">· Expires {format(new Date(m.expiryDate), "d MMM yyyy")}</span>
                        )}
                      </div>
                      {m.mileage > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">{m.mileage.toLocaleString()} mi</span>
                      )}
                    </div>
                    {(m.failures?.length ?? 0) > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {m.failures!.map((f, k) => (
                          <li key={k} className="text-xs text-foreground/85 leading-snug">
                            <span className="font-semibold uppercase tracking-wider text-destructive mr-1.5">Fail</span>{f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(m.advisories?.length ?? 0) > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {m.advisories!.map((a, k) => (
                          <li key={k} className="text-xs text-foreground/85 leading-snug">
                            <span className="font-semibold uppercase tracking-wider text-amber-400 mr-1.5">Advisory</span>{a}
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
              {r.motHistory.length > 1 && (
                <button
                  onClick={() => setShowAllMot(s => !s)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg hover:bg-muted/30"
                >
                  {showAllMot ? "Show less" : `Show full MOT history (${r.motHistory.length - 1} more)`}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllMot && "rotate-180")} />
                </button>
              )}
            </>
          )}
        </Section>

        {!valuationUnavailable && (
          <>
            <SimilarCars
              make={v.make}
              model={v.model.split(" · ")[0]}
              variant={v.model.includes(" · ") ? v.model.split(" · ")[1] : undefined}
              year={v.year}
              mileage={v.mileage}
            />

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
          </>
        )}

        <footer className="mt-10 pt-8 border-t border-border text-xs text-muted-foreground space-y-2">
          <p><strong className="text-foreground/80">Data sources:</strong> Live UK market pricing from MarketCheck UK, official MOT history from DVSA, and AI condition analysis from your photos.</p>
          <p><strong className="text-foreground/80">Disclaimer:</strong> Valuations are estimates for guidance only and do not constitute financial advice or a guaranteed sale price. Always verify HPI and MOT data through official sources before transacting.</p>
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

const SLOT_LABELS: Record<string, string> = {
  front: "Front 3/4",
  rear: "Rear 3/4",
  side: "Side profile",
  interior: "Interior",
  odometer: "Odometer",
  engine: "Engine bay",
  other: "Other photo",
};

function PhotoFeedback({
  insights,
  photoUrls,
  onSelectPhoto,
}: {
  insights: PhotoInsight[];
  photoUrls: string[];
  onSelectPhoto: (i: number) => void;
}) {
  // Group insights by photoIndex (fall back to grouping by slot when index missing)
  const grouped = new Map<number, PhotoInsight[]>();
  insights.forEach((ins) => {
    const idx = typeof ins.photoIndex === "number" && ins.photoIndex >= 0 && ins.photoIndex < photoUrls.length
      ? ins.photoIndex
      : -1;
    const arr = grouped.get(idx) ?? [];
    arr.push(ins);
    grouped.set(idx, arr);
  });

  const totalImpact = insights.reduce((sum, i) => sum + (i.priceImpact ?? 0), 0);
  const totalFixCost = insights.reduce((sum, i) => sum + (i.fixCost ?? 0), 0);
  const fixableUpside = insights
    .filter((i) => i.fixable && (i.priceImpact ?? 0) < 0)
    .reduce((sum, i) => sum + Math.abs(i.priceImpact ?? 0), 0);

  const orderedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === -1) return 1;
    if (b === -1) return -1;
    return a - b;
  });

  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">What the AI saw in your photos</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {totalImpact !== 0 && (
            <span className={cn(
              "tabular-nums font-medium rounded-full px-2.5 py-1 border",
              totalImpact > 0 ? "text-primary bg-primary/10 border-primary/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30",
            )}>
              Net impact {totalImpact > 0 ? "+" : "−"}£{Math.abs(totalImpact).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-5">
        <div className="grid gap-4">
          {orderedKeys.map((idx) => {
            const items = grouped.get(idx)!;
            const url = idx >= 0 ? photoUrls[idx] : undefined;
            const slotKey = items[0]?.slot ?? "other";
            return (
              <div key={idx} className="flex gap-3 sm:gap-4">
                {url ? (
                  <button
                    type="button"
                    onClick={() => onSelectPhoto(idx)}
                    className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-border/60 hover:border-primary/50 transition-colors relative group"
                    aria-label={`View ${SLOT_LABELS[slotKey] ?? "photo"}`}
                  >
                    <img src={url} alt={SLOT_LABELS[slotKey] ?? "photo"} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity grid place-items-end p-1.5">
                      <Camera className="h-3 w-3 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-muted/30 border border-border/40 grid place-items-center">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                    {SLOT_LABELS[slotKey] ?? "Photo"}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((ins, k) => (
                      <li key={k}>
                        <InsightRow insight={ins} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {(fixableUpside > 0 || totalFixCost > 0) && (
          <div className="mt-4 pt-4 border-t border-border/50 grid sm:grid-cols-2 gap-3">
            {fixableUpside > 0 && (
              <div className="rounded-lg bg-primary/[0.06] border border-primary/20 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary/90 mb-0.5">Potential upside if you fix the flagged items</div>
                <div className="text-base font-semibold tabular-nums text-foreground">+£{fixableUpside.toLocaleString()}</div>
              </div>
            )}
            {totalFixCost > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-0.5">Estimated cost to remedy</div>
                <div className="text-base font-semibold tabular-nums text-foreground/90">£{totalFixCost.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          AI observations are guidance only — based on what's visible in each photo. Always confirm condition in person.
        </p>
      </div>
    </section>
  );
}

function InsightRow({ insight }: { insight: PhotoInsight }) {
  const sev = insight.severity;
  const Icon = sev === "positive" ? TrendingUp : sev === "notable" ? TrendingDown : sev === "minor" ? AlertTriangle : Minus;
  const tone =
    sev === "positive" ? "text-primary" :
    sev === "notable" ? "text-red-400" :
    sev === "minor" ? "text-amber-400" :
    "text-muted-foreground";
  return (
    <div className="flex items-start gap-2">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", tone)} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug text-foreground/90">{insight.observation}</div>
        {(insight.priceImpact !== undefined || insight.fixCost !== undefined) && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {insight.priceImpact !== undefined && insight.priceImpact !== 0 && (
              <span className={cn(
                "inline-flex items-center text-[10px] tabular-nums font-medium rounded px-1.5 py-0.5 border",
                insight.priceImpact > 0
                  ? "text-primary bg-primary/10 border-primary/30"
                  : "text-amber-300 bg-amber-500/10 border-amber-500/30",
              )}>
                {insight.priceImpact > 0 ? "+" : "−"}£{Math.abs(insight.priceImpact).toLocaleString()}
              </span>
            )}
            {insight.fixCost !== undefined && insight.fixCost > 0 && (
              <span className="inline-flex items-center text-[10px] tabular-nums font-medium rounded px-1.5 py-0.5 border border-border/60 bg-muted/30 text-muted-foreground">
                Fix ~£{insight.fixCost.toLocaleString()}
              </span>
            )}
            {insight.fixable && insight.priceImpact !== undefined && insight.priceImpact < 0 && (
              <span className="inline-flex items-center text-[10px] font-medium rounded px-1.5 py-0.5 border border-primary/30 bg-primary/5 text-primary/90">
                Fixable
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

