import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ConditionGauge } from "@/components/ConditionGauge";
import { AdvertCreator } from "@/components/AdvertCreator";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";

import type { ValuationReport, PhotoInsight } from "@/lib/valuation";
import { downloadValuationPdf } from "@/lib/pdf";
import { format } from "date-fns";
import {
  Share2, Download, Check, ShieldCheck, AlertTriangle, ArrowLeft,
  Star, Pencil, ChevronDown, MoreHorizontal, Sparkles, Camera, TrendingUp, TrendingDown, Minus,
  Megaphone, FileCheck2, X, ChevronLeft, ChevronRight, History,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { signPhotoUrls } from "@/lib/photos";

interface Valuation {
  id: string; make: string; model: string; year: number; mileage: number;
  registration: string | null; mot_expiry: string | null;
  photo_urls: string[]; report: ValuationReport; created_at: string;
}

export default function Report() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isShared = location.pathname.startsWith("/shared/");
  const [v, setV] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [showOldAdvisories, setShowOldAdvisories] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [marketHistory, setMarketHistory] = useState<{
    make?: string; model?: string; trim?: string;
    ads: Array<{
      sold: boolean; mileage?: number; price?: number; originalPrice?: number;
      firstSeen?: string; lastSeen?: string; dealerType?: string; businessName?: string | null; adText?: string;
    }>;
  } | null>(null);
  const [specs, setSpecs] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    if (isShared) {
      // Public share view: fetch via edge function which signs photo URLs server-side.
      supabase.functions.invoke("get-shared-valuation", { body: { id } })
        .then(({ data, error }) => {
          if (!error && data && !(data as any).error) {
            const d = data as any;
            setV({ ...d, photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls.filter(Boolean) : [], report: d.report as ValuationReport });
            document.title = `${d.year} ${d.make} ${d.model} — Valu8`;
          }
          setLoading(false);
        });
      return;
    }
    supabase.from("valuations").select("*").eq("id", id).maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          const refs = Array.isArray(data.photo_urls) ? (data.photo_urls as string[]) : [];
          // Refresh signed URLs on every load so photos always render even after expiry.
          const signed = refs.length > 0 ? (await signPhotoUrls(refs)).filter(Boolean) : [];
          setV({ ...(data as any), photo_urls: signed, report: data.report as unknown as ValuationReport });
          document.title = `${data.year} ${data.make} ${data.model} — Valu8`;
        }
        setLoading(false);
      });
  }, [id, isShared]);

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

  // MotorSpecs — previous-ads + identity-specs in one call
  useEffect(() => {
    if (!v?.registration) { setMarketHistory(null); setSpecs(null); return; }
    let cancelled = false;
    supabase.functions
      .invoke("motorspecs", {
        body: { registration: v.registration, endpoints: ["previous-ads", "identity-specs"] },
      })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const results = (data as any)?.results ?? {};
        const ads = results["previous-ads"];
        if (ads?.ok && ads?.normalised && Array.isArray(ads.normalised.ads) && ads.normalised.ads.length > 0) {
          setMarketHistory(ads.normalised);
        }
        const id = results["identity-specs"];
        if (id?.ok && id?.normalised) setSpecs(id.normalised);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [v?.registration]);


  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (!v) return;
      const max = v.photo_urls.length - 1;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === "ArrowRight" && lightboxIndex < max) setLightboxIndex(lightboxIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, v]);

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

  // Specialist Valuation logic — combines multiple signals so a normal
  // mainstream car doesn't trigger it from a temporary MarketCheck gap.
  const carAge = new Date().getUTCFullYear() - v.year;
  const expectedMileage = Math.max(1, carAge * 8500);
  const mileageRatio = v.mileage / expectedMileage;
  const aiConfidence = r.marketConfidence ?? "Medium";
  const photoInsightCount = Array.isArray(r.photoInsights) ? r.photoInsights.length : 0;

  const rarityReasons: string[] = [];
  // Only count *genuinely* thin markets — common cars routinely sit in the 25–80 range
  // for a specific year/model and should NOT trigger the specialist treatment.
  if (liveCount != null && liveCount < 15) rarityReasons.push("very few comparable cars are listed in the UK right now");
  if (carAge >= 25) rarityReasons.push("its age puts it into modern-classic territory");
  if (carAge <= 0 && liveCount != null && liveCount < 60) rarityReasons.push("it's a brand-new model with very limited resale data");
  if (mileageRatio < 0.25) rarityReasons.push("it has exceptionally low mileage for its age");
  if (mileageRatio > 2.8) rarityReasons.push("it has an unusually high mileage profile");
  if (r.rareCarWarning) rarityReasons.push("of its rare specification or trim");
  if (aiConfidence === "Very Low") rarityReasons.push("our AI flagged it as a harder-than-average car to price");

  // Trigger expert overlay ONLY when the car is genuinely difficult to price,
  // OR when we have real previous-ads anchored data for this exact VRM (which
  // is the strongest, most defensible signal — show it off).
  const hasPrevAdsAnchor = typeof r.previousAdsAnchor === "number" && (r.previousAdsCount ?? 0) >= 1;
  const strongSingleSignal =
    (liveCount != null && liveCount < 3) ||
    !!r.rareCarWarning ||
    aiConfidence === "Very Low";
  const showSpecialistBadge =
    !!r.expertInsight?.shown ||
    hasPrevAdsAnchor ||
    (strongSingleSignal && rarityReasons.length >= 1) ||
    rarityReasons.length >= 3;

  const liveConfidenceLine =
    liveTier === "High"
      ? "Priced from a deep pool of live UK listings — a well-supported valuation."
      : liveTier === "Medium"
      ? "Based on a healthy sample of similar cars on the market right now."
      : "Fewer live comparables right now — treat this as a strong estimate rather than a precise figure.";

  const specialistExplanation = (() => {
    if (!showSpecialistBadge) return null;
    // Prefer the server-provided reason — it knows exactly which data sources fed the valuation.
    if (r.expertInsight?.reason) return r.expertInsight.reason;
    if (hasPrevAdsAnchor) {
      return `Anchored to ${r.previousAdsCount} real prior listing${r.previousAdsCount === 1 ? "" : "s"} for this exact registration${(r.previousAdsSoldCount ?? 0) > 0 ? ` (including ${r.previousAdsSoldCount} sold)` : ""}, time- and mileage-adjusted to today.`;
    }
    const top = rarityReasons.slice(0, 2);
    if (top.length === 0) {
      return "We've layered expert analysis on top of live market data to give you a confident figure on a harder-than-average car to price.";
    }
    if (top.length === 1) {
      return `Because ${top[0]}, we've layered expert analysis on top of live market data to give you a confident figure.`;
    }
    return `Because ${top[0]} and ${top[1]}, we've layered expert analysis on top of live market data to give you a confident figure.`;
  })();

  const share = async () => {
    const shareUrl = `${window.location.origin}/shared/${v?.id ?? id}`;
    try {
      await navigator.share?.({ title: `${v?.year} ${v?.make} ${v?.model} — Valu8`, url: shareUrl });
    } catch {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container py-6 md:py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          {isShared ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Valu8</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> All valuations</Link>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="premium"
              size="sm"
              onClick={async () => {
                const id = toast.loading("Generating PDF…");
                try {
                  await downloadValuationPdf(v, r);
                  toast.success("Report downloaded successfully", { id });
                } catch (err) {
                  console.error("PDF download failed", err);
                  toast.error("Couldn't generate PDF", {
                    id,
                    description: "Please try again.",
                    action: { label: "Retry", onClick: () => downloadValuationPdf(v, r).catch(() => {}) },
                  });
                }
              }}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
            {!isShared && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => navigate(`/valuation/${v.id}/edit`)}>
                    <Pencil className="h-4 w-4" /> Edit valuation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={share}>
                    <Share2 className="h-4 w-4" /> Share link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>


        {/* Hero Verdict — first thing the user sees */}
        {!valuationUnavailable && (() => {
          const verdict =
            r.conditionScore >= 8
              ? { label: "Strong position to sell", tone: "primary" as const, sub: "Quality examples like this move fast." }
              : r.conditionScore >= 6.5
              ? { label: "Good value — sell privately", tone: "primary" as const, sub: "Price honestly and lead with photos + history." }
              : { label: "Needs attention before listing", tone: "amber" as const, sub: "A few tidy-ups will lift your sale price." };
          return (
            <div className={cn(
              "mb-4 inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 animate-fade-in-up backdrop-blur-sm",
              verdict.tone === "primary"
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-amber-500/35 bg-amber-500/10 text-amber-300",
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full animate-pulse",
                verdict.tone === "primary" ? "bg-primary" : "bg-amber-400",
              )} />
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold">Verdict: {verdict.label}</span>
              <span className="hidden sm:inline text-[11px] text-foreground/70 font-normal normal-case tracking-normal">· {verdict.sub}</span>
            </div>
          );
        })()}

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
          {(r as any).regenerationReason && (
            <p className="mt-2 text-[11px] text-primary/80 max-w-[60ch]">
              {(r as any).regenerationReason}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground max-w-[60ch]">
            Guidance only — this is an AI-assisted estimate, not a regulated valuation or financial advice.
          </p>
        </div>

        {/* Quick Summary — confident verdict + scannable bullets + trust strip */}
        {!valuationUnavailable && (() => {
          const verdict =
            r.conditionScore >= 8
              ? { label: "Sell privately", tone: "primary" as const, line: "A clean private sale is your best route — quality examples like this attract serious buyers fast." }
              : r.conditionScore >= 6.5
              ? { label: "Sell privately", tone: "primary" as const, line: "Worth a private sale, but price honestly and lead with photos + history to build trust." }
              : { label: "Consider trade-in", tone: "amber" as const, line: "Condition or mileage will hold back private buyers — a part-exchange may be smoother." };
          const upside = (r.photoInsights ?? [])
            .filter(i => i.fixable && (i.priceImpact ?? 0) < 0)
            .reduce((s, i) => s + Math.abs(i.priceImpact ?? 0), 0);
          const latestAdv = r.motHistory?.[0]?.advisories?.length ?? 0;
          return (
            <section className="mb-5 animate-fade-in-up">
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Quick Summary</h2>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full border",
                    verdict.tone === "primary"
                      ? "text-primary bg-primary/10 border-primary/30"
                      : "text-amber-300 bg-amber-500/10 border-amber-500/30",
                  )}>
                    Our verdict: {verdict.label}
                  </span>
                </div>

                <p className="text-sm leading-[1.55] text-foreground/90 mb-4 max-w-[58ch]">
                  {verdict.line}
                </p>

                <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5 text-sm">
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      Realistic private sale: <strong className="tabular-nums text-foreground">£{r.values.privateSale.toLocaleString()}</strong>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      Condition: <strong className="text-foreground">{r.conditionLabel}</strong>
                      <span className="text-muted-foreground"> · {r.conditionScore}/10</span>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      Market: <strong className="text-foreground">{showSpecialistBadge ? "Expert insight" : `${liveTier} confidence`}</strong>
                      {liveCount != null && <span className="text-muted-foreground"> · {liveCount.toLocaleString()} live UK listings</span>}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      {upside > 0
                        ? (<>Upside if you tidy flagged items: <strong className="tabular-nums text-primary">+£{upside.toLocaleString()}</strong></>)
                        : latestAdv > 0
                        ? (<>Latest MOT: <strong className="text-amber-300">{latestAdv} current advisor{latestAdv === 1 ? "y" : "ies"}</strong></>)
                        : (<>Latest MOT: <strong className="text-emerald-300">No current advisories</strong></>)}
                    </span>
                  </li>
                </ul>

                {/* Trust strip — the data moat made visible */}
                <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> DVSA MOT history</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> MarketCheck UK live pricing</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> AI vision condition</span>
                </div>
              </div>
            </section>
          );
        })()}




        {/* Photo gallery */}
        {v.photo_urls.length > 0 && (
          <section className="premium-card p-2 mb-4 animate-fade-in-up">
            <button
              type="button"
              onClick={() => setLightboxIndex(activePhoto)}
              className="block w-full aspect-[16/9] rounded-md overflow-hidden bg-muted"
            >
              <img src={v.photo_urls[activePhoto]} alt={`${v.make} ${v.model}`} className="w-full h-full object-cover" />
            </button>
            {v.photo_urls.length > 1 && (
              <div className="grid grid-cols-6 gap-1 mt-1.5">
                {v.photo_urls.map((u, i) => (
                  <button key={u} onClick={() => { setActivePhoto(i); setLightboxIndex(i); }}
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
            <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />

            {/* Eyebrow + confidence pill */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap relative">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                {valuationUnavailable ? "Valuation status" : "Realistic Private Sale Price"}
              </span>
              {!valuationUnavailable && (
                showSpecialistBadge ? (
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/30 font-semibold">
                    <ShieldCheck className="h-3 w-3" /> Expert insight
                  </span>
                ) : (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em] px-2.5 py-1 rounded-full border font-semibold",
                    liveTier === "High" && "text-primary bg-primary/10 border-primary/30",
                    liveTier === "Medium" && "text-amber-400 bg-amber-500/10 border-amber-500/30",
                    liveTier === "Low" && "text-muted-foreground bg-muted/40 border-border",
                  )}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      liveTier === "High" && "bg-primary animate-pulse",
                      liveTier === "Medium" && "bg-amber-400",
                      liveTier === "Low" && "bg-muted-foreground",
                    )} /> {liveTier} confidence
                  </span>
                )
              )}
            </div>

            {valuationUnavailable ? (
              <div className="max-w-xl relative">
                <div className="text-2xl sm:text-3xl font-semibold leading-tight text-foreground tracking-tight">
                  Unable to value accurately
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  {r.valueReasoning || r.honestAnalysis}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Headline price — bigger, tighter, more Apple */}
                <div className="text-5xl sm:text-6xl font-semibold tabular-nums text-gradient-primary leading-[0.95] tracking-tight">
                  <CountUp value={r.values.privateSale} prefix="£" />
                </div>
                <p className="text-[12px] text-muted-foreground mt-2 max-w-[44ch]">
                  Realistic private sale in today's UK market.
                </p>

                {/* Live data ticker */}
                {liveCount != null && liveCount > 0 && (
                  <div className="mt-2.5 inline-flex items-center gap-2 text-[11.5px] text-muted-foreground/90">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <span className="font-medium text-foreground/85 tabular-nums">{liveCount.toLocaleString()}</span>
                      <span>comparable cars listed live in the UK</span>
                    </span>
                  </div>
                )}

                {/* Specialist Valuation callout — proper trust block, not a footnote */}
                {showSpecialistBadge && specialistExplanation && (
                  <div className="mt-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] px-4 py-3 flex gap-3">
                    <div className="shrink-0 h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center mt-0.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10.5px] uppercase tracking-[0.16em] text-primary font-semibold mb-1">
                        Expert Insight Applied
                      </div>
                      <p className="text-[12.5px] leading-[1.55] text-foreground/85">
                        {specialistExplanation}
                      </p>
                      {Array.isArray(r.expertInsight?.sources) && r.expertInsight!.sources.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {r.expertInsight!.sources.map((s, i) => (
                            <li key={i} className="inline-flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-primary/80" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* Always-on "Data used" strip for the common, well-supported case
                    where no Expert Insight badge is shown. Keeps transparency. */}
                {!showSpecialistBadge && Array.isArray(r.expertInsight?.sources) && r.expertInsight!.sources.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3">
                    <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-1.5">
                      Data used for this valuation
                    </div>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-foreground/75">
                      {r.expertInsight!.sources.map((s, i) => (
                        <li key={i} className="inline-flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-primary/70" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {r.rareCarWarning && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] sm:text-xs text-amber-200/90 leading-relaxed">
                <span className="font-medium text-amber-300">Limited data:</span> {r.rareCarWarning}
              </div>
            )}
            {valuationUnavailable ? (
              <p className="text-sm sm:text-base leading-[1.65] text-[#E8E8E8] mt-4 max-w-[44ch]">
                We'd rather be honest than give you a number that could be way off.
              </p>
            ) : (
              <details className="mt-4 group max-w-[44ch]">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-semibold text-primary/90 hover:text-primary">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  Why this price
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-[1.6] text-[#E8E8E8]">
                    {r.headline ? (
                      r.headline
                    ) : (
                      <>
                        Based on live UK market data, a realistic figure for this {v.year} {v.make} {v.model} sits around{" "}
                        <span className="tabular-nums font-medium">£{r.values.privateSale.toLocaleString()}</span>.
                      </>
                    )}
                  </p>
                  <p className="text-sm leading-[1.6] text-[#E8E8E8]/85">
                    {r.marketContext || liveConfidenceLine}
                  </p>
                  {(() => {
                    const positives = (r.factorsUp && r.factorsUp.length > 0)
                      ? r.factorsUp
                      : (r.priceAdjustments?.filter(a => a.impactPct > 0).map(a => a.label) ?? []);
                    const negatives = (r.factorsDown && r.factorsDown.length > 0)
                      ? r.factorsDown
                      : (r.priceAdjustments?.filter(a => a.impactPct < 0).map(a => a.label) ?? []);
                    if (positives.length === 0 && negatives.length === 0) {
                      return r.valueReasoning ? (
                        <p className="text-sm leading-[1.6] text-[#E8E8E8]/85">{r.valueReasoning}</p>
                      ) : null;
                    }
                    const join = (arr: string[]) =>
                      arr.length <= 1 ? (arr[0] ?? "") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
                    return (
                      <p className="text-sm leading-[1.6] text-[#E8E8E8]/85">
                        {positives.length > 0 && <>{join(positives)} {positives.length > 1 ? "all push" : "pushes"} the value up. </>}
                        {negatives.length > 0 && <>We've nudged it down for {join(negatives)}.</>}
                      </p>
                    );
                  })()}
                </div>
              </details>
            )}

            {/* Suggested Asking Price — with visual price band */}
            {!valuationUnavailable && (() => {
              const base = r.recommendedAskingPrice || r.recommendations?.recommendedAskingPrice || r.recommendations.listingPrice || Math.round(r.values.privateSale * 1.04 / 50) * 50;
              const spread = Math.max(500, Math.round(base * 0.035 / 50) * 50);
              const rangeLow = Math.round((base - spread) / 50) * 50;
              const rangeHigh = Math.round((base + spread) / 50) * 50;
              const buffer = r.negotiationBuffer || r.recommendations?.negotiationBuffer || Math.round(base * 0.04 / 50) * 50;
              const marketLow = r.valueRange?.privateSaleLow ?? Math.round(r.values.privateSale * 0.95 / 50) * 50;
              const marketHigh = r.valueRange?.privateSaleHigh ?? Math.round(r.values.privateSale * 1.08 / 50) * 50;
              // Build the visual band — extend slightly past market bounds for breathing room
              const trackLow = Math.min(marketLow, rangeLow) - Math.max(200, spread * 0.4);
              const trackHigh = Math.max(marketHigh, rangeHigh) + Math.max(200, spread * 0.4);
              const trackSpan = Math.max(1, trackHigh - trackLow);
              const pct = (v: number) => Math.max(0, Math.min(100, ((v - trackLow) / trackSpan) * 100));
              const askLeft = pct(rangeLow);
              const askWidth = Math.max(6, pct(rangeHigh) - askLeft);
              const marketLeft = pct(marketLow);
              const marketWidth = Math.max(4, pct(marketHigh) - marketLeft);
              const valLeft = pct(r.values.privateSale);
              return (
                <div className="mt-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent px-4 py-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-primary/90 font-semibold">Suggested Asking Price</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">Negotiation buffer ~£{buffer.toLocaleString()}</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-foreground leading-none tracking-tight">
                    £{rangeLow.toLocaleString()} – £{rangeHigh.toLocaleString()}
                  </div>

                  {/* Price band visualization */}
                  <div className="mt-5 mb-1">
                    <div className="relative h-9">
                      {/* base track */}
                      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-muted/40" />
                      {/* market range */}
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/30"
                        style={{ left: `${marketLeft}%`, width: `${marketWidth}%` }}
                        aria-label="Live market range"
                      />
                      {/* asking range */}
                      <div
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_12px_hsl(176_100%_42%_/_0.5)]"
                        style={{ left: `${askLeft}%`, width: `${askWidth}%` }}
                        aria-label="Your suggested asking range"
                      />
                      {/* realistic sale marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${valLeft}%` }}
                      >
                        <span className="h-3.5 w-3.5 rounded-full bg-background border-2 border-primary shadow-[0_0_0_3px_hsl(176_100%_42%_/_0.18)]" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] tabular-nums text-muted-foreground/80">
                      <span>£{Math.round(trackLow / 100) * 100 >= 1000 ? `${Math.round(trackLow / 100) * 100 / 1000}k` : Math.round(trackLow / 100) * 100}</span>
                      <span>£{Math.round(trackHigh / 100) * 100 >= 1000 ? `${Math.round(trackHigh / 100) * 100 / 1000}k` : Math.round(trackHigh / 100) * 100}</span>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-primary" /> Ask range</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-muted-foreground/40" /> Live market</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-primary bg-background" /> Realistic sale</span>
                    </div>
                  </div>

                  <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed max-w-[48ch]">
                    Where you land depends on photos, history file and how quickly you need to sell. Comparable UK cars are asking between <span className="tabular-nums text-foreground/85">£{marketLow.toLocaleString()}</span> and <span className="tabular-nums text-foreground/85">£{marketHigh.toLocaleString()}</span>.
                  </p>
                </div>
              );
            })()}

            {/* Pro Tip — negotiation guidance */}
            {!valuationUnavailable && (
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-semibold text-amber-300/90 hover:text-amber-300">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  💡 Pro tip — listing & offers
                </summary>
                {(() => {
                  const base = r.recommendedAskingPrice || r.recommendations?.recommendedAskingPrice || r.recommendations.listingPrice || Math.round(r.values.privateSale * 1.04 / 50) * 50;
                  const listAt = Math.round((base * 1.015) / 50) * 50;
                  const buffer = r.negotiationBuffer || r.recommendations?.negotiationBuffer || Math.round(base * 0.04 / 50) * 50;
                  const offerLow = Math.max(Math.round(r.values.privateSale * 0.95 / 50) * 50, Math.round((listAt - buffer * 1.6) / 50) * 50);
                  const offerHigh = Math.max(r.values.privateSale, Math.round((listAt - buffer * 0.7) / 50) * 50);
                  return (
                    <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.55] text-[#E8E8E8]">
                      <li>• List at <strong className="tabular-nums">£{listAt.toLocaleString()}</strong> — small head-room without scaring buyers.</li>
                      <li>• Expect offers between <strong className="tabular-nums">£{offerLow.toLocaleString()}–£{offerHigh.toLocaleString()}</strong>.</li>
                      <li>• Don't drop below <strong className="tabular-nums">£{r.values.privateSale.toLocaleString()}</strong> unless you need a fast sale.</li>
                    </ul>
                  );
                })()}
              </details>
            )}

            {!valuationUnavailable && liveCount == null && (
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Valued using AI market analysis — fewer live comparables available for this model right now.
              </p>
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


        {/* Honest analysis — max 2 bullets, punchy */}
        {(() => {
          const bullets = r.honestAnalysis
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 2);
          return (
            <CollapsibleSection
              title="Honest Analysis"
              icon={Sparkles}
              preview={bullets[0]}
            >
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-snug text-foreground/90">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          );
        })()}


        {/* Per-photo AI feedback — our moat made visible */}
        {r.photoInsights && r.photoInsights.length > 0 && v.photo_urls.length > 0 && (
          <PhotoFeedback insights={r.photoInsights} photoUrls={v.photo_urls} onSelectPhoto={setActivePhoto} onOpenLightbox={setLightboxIndex} />
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
          <CollapsibleSection
            title="Market Positioning"
            icon={TrendingUp}
            preview={r.marketPositioning}
          >
            <p className="text-sm leading-relaxed text-foreground/90">{r.marketPositioning}</p>
          </CollapsibleSection>
        )}

        {/* Verified Vehicle Specification — MotorSpecs identity-specs (DVLA + MVRIS + JATO) */}
        {specs && (() => {
          const fmt = (n: any, suffix = "") =>
            n === undefined || n === null || n === "" ? null : `${typeof n === "number" ? n.toLocaleString() : n}${suffix}`;
          const rows: Array<[string, string | null]> = [
            ["Make / Model", [specs.make, specs.model].filter(Boolean).join(" ") || null],
            ["Version", specs.version ?? specs.trim ?? null],
            ["Generation", specs.generation ? `Mk${specs.generation}${specs.series ? ` (${specs.series})` : ""}` : specs.series ?? null],
            ["Year", fmt(specs.year)],
            ["First registered", specs.regDate ?? null],
            ["Body", [specs.bodyStyle, specs.doors ? `${specs.doors}dr` : null, specs.seats ? `${specs.seats} seats` : null].filter(Boolean).join(" · ") || null],
            ["Engine", [specs.engineCC ? `${specs.engineCC}cc` : null, specs.fuelType, specs.fuelDelivery].filter(Boolean).join(" · ") || null],
            ["Power", specs.powerBHP ? `${specs.powerBHP} bhp${specs.powerKW ? ` (${specs.powerKW} kW)` : ""}` : null],
            ["Torque", fmt(specs.torqueNm, " Nm")],
            ["Transmission", [specs.transmission, specs.gears ? `${specs.gears}-spd` : null, specs.driveType].filter(Boolean).join(" · ") || null],
            ["Economy (combined)", fmt(specs.combinedMpg, " mpg")],
            ["0–60 mph", fmt(specs.zeroToSixtyS, " s")],
            ["Top speed", fmt(specs.topSpeedMph, " mph")],
            ["CO₂", fmt(specs.co2, " g/km")],
            ["Euro status", fmt(specs.euroStatus)],
            ["Kerb weight", fmt(specs.kerbWeightKg, " kg")],
            ["Colour", specs.colour ?? null],
            ["VIN", specs.vin ?? null],
            ["Origin", specs.origin ?? null],
            ["Previous keepers", fmt(specs.keepers?.numberOfPrevious)],
            ["Current keeper since", specs.keepers?.currentSince ?? null],
            ["Segment", specs.localSegment ?? specs.globalSegment ?? null],
          ].filter(([, val]) => val !== null && val !== undefined && val !== "") as Array<[string, string]>;
          return (
            <CollapsibleSection
              title="Verified Vehicle Specification"
              icon={ShieldCheck}
              badge={
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
                  DVLA + MVRIS
                </span>
              }
            >
              <p className="text-xs text-muted-foreground mb-4">
                Sourced live from MotorSpecs for <span className="font-mono font-semibold text-foreground">{specs.vrm ?? v.registration}</span>
                {specs.desirabilityScore ? <> · Desirability score <span className="text-foreground font-semibold">{specs.desirabilityScore}</span></> : null}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {rows.map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-border/40 py-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-medium text-right">{val}</span>
                  </div>
                ))}
              </div>
              {Array.isArray(specs.similarVehicles) && specs.similarVehicles.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Similar variants ({specs.similarVehicles.length})</div>
                  <ul className="space-y-1.5 text-sm">
                    {specs.similarVehicles.slice(0, 6).map((s: any) => (
                      <li key={s.id} className="flex justify-between gap-3 border-b border-border/30 py-1.5">
                        <span className="text-foreground">{s.year} {s.make} {s.model} <span className="text-muted-foreground">— {s.version}</span></span>
                        <span className="text-muted-foreground text-xs">{s.transmissionDescription ?? s.transmission}{s.powerBHP ? ` · ${s.powerBHP}bhp` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleSection>
          );
        })()}

        {/* Recent Market History — real previous ads for this VRM (MotorSpecs) */}
        {marketHistory && marketHistory.ads.length > 0 && (() => {
          const ads = [...marketHistory.ads].sort((a, b) =>
            (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "")
          );
          const soldAds = ads.filter(a => a.sold);
          const listedAds = ads.filter(a => !a.sold);
          const pricesWith = (xs: typeof ads) => xs.map(a => a.price).filter((n): n is number => typeof n === "number");
          const soldPrices = pricesWith(soldAds);
          const listedPrices = pricesWith(listedAds);
          const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, n) => s + n, 0) / xs.length) : null;
          const avgSold = avg(soldPrices);
          const avgListed = avg(listedPrices);
          const fmtGBP = (n?: number | null) =>
            typeof n === "number" ? `£${n.toLocaleString()}` : "—";
          const fmtDate = (iso?: string) => {
            if (!iso) return "—";
            try { return format(new Date(iso), "MMM yyyy"); } catch { return iso.slice(0, 10); }
          };
          return (
            <CollapsibleSection
              title="Recent Market History"
              icon={History}
              badge={
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
                  Verified data
                </span>
              }
              preview={
                <>
                  {ads.length} previous {ads.length === 1 ? "listing" : "listings"}
                  {soldAds.length > 0 && <> · {soldAds.length} sold</>}
                  {avgSold && <> · avg {fmtGBP(avgSold)}</>}
                </>
              }
            >
              <div className="space-y-4">
                <div className="rounded-xl bg-primary/[0.06] border border-primary/20 px-4 py-2.5">
                  <p className="text-[11px] leading-relaxed text-foreground/80">
                    <span className="font-semibold text-primary">Based on previous listings for this exact registration</span>
                    {" "}<span className="font-mono uppercase">{v.registration}</span>
                    {marketHistory.make && marketHistory.model && (
                      <> — matched as {marketHistory.make} {marketHistory.model}{marketHistory.trim ? ` ${marketHistory.trim}` : ""}</>
                    )}.
                  </p>
                </div>

                {/* Summary stats */}
                {(avgSold || avgListed) && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Listings</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">{ads.length}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-emerald-300/90 font-semibold">Avg sold</div>
                      <div className="text-lg font-bold text-emerald-200 mt-0.5">{fmtGBP(avgSold)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Avg asked</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">{fmtGBP(avgListed)}</div>
                    </div>
                  </div>
                )}

                {/* Timeline of listings */}
                <ol className="relative space-y-2.5 pl-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {ads.map((a, i) => {
                    const dropped = typeof a.originalPrice === "number" && typeof a.price === "number" && a.originalPrice > a.price;
                    const drop = dropped ? (a.originalPrice! - a.price!) : 0;
                    return (
                      <li key={i} className="relative">
                        <span className={cn(
                          "absolute -left-4 top-3 h-2.5 w-2.5 rounded-full border-2",
                          a.sold
                            ? "bg-emerald-400 border-emerald-300/40 shadow-[0_0_8px_hsl(152_70%_55%/0.6)]"
                            : "bg-muted-foreground/40 border-border"
                        )} />
                        <div className={cn(
                          "rounded-xl border px-4 py-3 transition-colors",
                          a.sold
                            ? "border-emerald-400/25 bg-emerald-400/[0.04]"
                            : "border-border/60 bg-background/40"
                        )}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-xl font-bold text-foreground tabular-nums">{fmtGBP(a.price)}</span>
                                {dropped && (
                                  <>
                                    <span className="text-xs text-muted-foreground line-through tabular-nums">{fmtGBP(a.originalPrice)}</span>
                                    <span className="text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                                      <TrendingDown className="h-2.5 w-2.5" /> −£{drop.toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span className="text-foreground/70 font-medium">
                                  {fmtDate(a.firstSeen)}
                                  {a.lastSeen && a.lastSeen !== a.firstSeen && <> → {fmtDate(a.lastSeen)}</>}
                                </span>
                                {typeof a.mileage === "number" && (
                                  <><span>·</span><span>{a.mileage.toLocaleString()} mi</span></>
                                )}
                                {a.dealerType && (
                                  <><span>·</span><span className="capitalize">{a.dealerType}</span></>
                                )}
                                {a.businessName && (
                                  <><span>·</span><span className="truncate max-w-[180px]">{a.businessName}</span></>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border shrink-0",
                              a.sold
                                ? "text-emerald-200 bg-emerald-400/15 border-emerald-400/40"
                                : "text-muted-foreground bg-muted/30 border-border/60"
                            )}>
                              {a.sold ? "Sold" : "Withdrawn"}
                            </span>
                          </div>
                          {a.adText && a.adText.trim() && (
                            <p className="mt-2 text-[12px] leading-snug text-foreground/70 italic border-l-2 border-border/60 pl-2.5">
                              "{a.adText.trim()}"
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  Source: MotorSpecs ad-history database. Past prices are a strong indicator but not a guarantee of current market value.
                </p>
              </div>
            </CollapsibleSection>
          );
        })()}




        {/* Strengths + Watch Points — collapsible */}
        {!valuationUnavailable && (() => {
          const latestMot = r.motHistory?.[0];
          const currentAdvisories = latestMot?.advisories ?? [];
          return (
            <>
              <CollapsibleSection
                title="Strengths"
                icon={Star}
                badge={
                  <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
                    {r.strengths.length}
                  </span>
                }
                preview={r.strengths[0]}
              >
                <ul className="space-y-2">
                  {r.strengths.map(s => (
                    <li key={s} className="flex gap-2.5 text-sm leading-snug">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>

              <CollapsibleSection
                title="Watch Points"
                icon={AlertTriangle}
                defaultOpen={currentAdvisories.length >= 3 || !!r.motHistory?.some((m: any) => m.result === "Fail")}
                badge={
                  currentAdvisories.length > 0 ? (
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                      {currentAdvisories.length}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                      Clean
                    </span>
                  )
                }
                preview={currentAdvisories.length > 0 ? currentAdvisories[0] : "No advisories on the latest MOT"}
              >
                {currentAdvisories.length === 0 ? (
                  <div className="flex items-start gap-2.5 text-sm leading-snug">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-emerald-300">No advisories on the latest MOT</span>
                  </div>
                ) : (
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
                )}
              </CollapsibleSection>
            </>
          );
        })()}



        {/* Previously Rectified Advisories */}
        {r.motHistory && r.motHistory.length > 1 && (() => {
          const currentSet = new Set((r.motHistory[0]?.advisories ?? []).map(a => a.toLowerCase()));
          const oldAdvisories = Array.from(new Set(
            r.motHistory.slice(1).flatMap((m: any) => m.advisories ?? [])
              .filter((a: string) => !currentSet.has(a.toLowerCase()))
          ));
          if (oldAdvisories.length === 0) return null;
          return (
            <section className="mb-6 animate-fade-in-up">
              <button
                onClick={() => setShowOldAdvisories(s => !s)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 px-5 py-4 text-left hover:bg-card/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Previously Rectified Advisories</h2>
                  <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">{oldAdvisories.length}</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showOldAdvisories && "rotate-180")} />
              </button>
              {showOldAdvisories && (
                <div className="mt-2 rounded-2xl border border-border/50 bg-card/50 p-5">
                  <p className="text-[11px] text-muted-foreground mb-3">These advisories appeared on earlier MOTs and are no longer present — likely fixed before the latest test.</p>
                  <ul className="space-y-2">
                    {oldAdvisories.map((a, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-snug text-muted-foreground">
                        <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{a}</span>
                        <span className="text-[10px] text-emerald-400/80 ml-auto shrink-0">Fixed on latest MOT</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })()}

        {/* Recommendations */}
        {!valuationUnavailable && (
          <CollapsibleSection
            title="Seller Recommendations"
            icon={Megaphone}
            preview={`Where to sell, what to highlight, what to prepare`}
            badge={
              <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">
                3 guides
              </span>
            }
          >
            <div className="grid md:grid-cols-2 gap-6">
              <RecBlock title="Where to sell" items={r.recommendations.whereToSell} />
              <RecBlock title="What to highlight" items={r.recommendations.highlights} />
              <RecBlock title="Documents to prepare" items={r.recommendations.documents} />
            </div>
          </CollapsibleSection>
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
        {(() => {
          const latest = r.motHistory?.[0];
          const previewText = latest
            ? `${latest.result} · ${format(new Date(latest.date), "d MMM yyyy")}${latest.mileage > 0 ? ` · ${latest.mileage.toLocaleString()} mi` : ""}`
            : "No prior MOT records";
          const hasFail = r.motHistory?.some((m: any) => m.result === "Fail");
          return (
            <CollapsibleSection
              title="MOT History"
              icon={FileCheck2}
              defaultOpen={!!hasFail}
              preview={previewText}
              badge={
                <>
                  {r.motSource === "dvsa" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border text-primary bg-primary/5 border-primary/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Live DVSA
                    </span>
                  )}
                  {r.motHistory.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">
                      {r.motHistory.length} {r.motHistory.length === 1 ? "test" : "tests"}
                    </span>
                  )}
                </>
              }
            >
              {r.motNotice && r.motSource !== "dvsa" && (
                <p className="text-xs text-muted-foreground mb-3">{r.motNotice}</p>
              )}
              {r.motHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prior MOT records (vehicle under 3 years old).</p>
              ) : (
                <ol className="space-y-3">
                  {r.motHistory.map((m, i) => (
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
              )}
            </CollapsibleSection>
          );
        })()}

        {!valuationUnavailable && (
          <>


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

      {/* Fullscreen photo lightbox */}
      {lightboxIndex !== null && v && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors"
            aria-label="Close fullscreen photo"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}

          {/* Next */}
          {lightboxIndex < v.photo_urls.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}

          {/* Image */}
          <img
            src={v.photo_urls[lightboxIndex]}
            alt={`${v.make} ${v.model} photo ${lightboxIndex + 1}`}
            className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.14em] text-white/70 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
            {lightboxIndex + 1} / {v.photo_urls.length}
          </div>
        </div>
      )}
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

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  right,
  preview,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-4 animate-fade-in-up">
      <div
        className={cn(
          "rounded-2xl border transition-all duration-300 overflow-hidden",
          open
            ? "border-primary/30 bg-card/70 shadow-[0_0_28px_-14px_hsl(var(--primary)/0.45)]"
            : "border-border/50 bg-card/40 hover:bg-card/60 hover:border-border"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="w-full flex items-center gap-3 px-5 sm:px-6 py-4 text-left group"
        >
          {Icon && (
            <span
              className={cn(
                "h-8 w-8 rounded-lg grid place-items-center shrink-0 transition-all",
                open ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground group-hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className={cn(
                  "text-sm font-medium uppercase tracking-[0.14em] transition-colors",
                  open ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {title}
              </h2>
              {badge}
            </div>
            {preview && !open && (
              <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">{preview}</p>
            )}
          </div>
          {right && <div className="mr-2">{right}</div>}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-all duration-300 shrink-0",
              open ? "rotate-180 text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
        </button>
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1">{children}</div>
          </div>
        </div>
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
  onOpenLightbox,
}: {
  insights: PhotoInsight[];
  photoUrls: string[];
  onSelectPhoto: (i: number) => void;
  onOpenLightbox?: (i: number) => void;
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
    // Sort by severity weight then index — surface the most important photos first
    const weight = (arr: PhotoInsight[]) =>
      arr.reduce((w, i) => w + (i.severity === "notable" ? 3 : i.severity === "minor" ? 2 : i.severity === "positive" ? 1 : 0), 0);
    const wa = weight(grouped.get(a)!);
    const wb = weight(grouped.get(b)!);
    if (wb !== wa) return wb - wa;
    return a - b;
  });

  const positiveCount = insights.filter(i => i.severity === "positive").length;
  const notableCount = insights.filter(i => i.severity === "notable").length;
  const minorCount = insights.filter(i => i.severity === "minor").length;
  const fixableCount = insights.filter(i => i.fixable && (i.priceImpact ?? 0) < 0).length;

  return (
    <section className="mb-7 animate-fade-in-up">
      {/* Hero header — positions this as Valu8's differentiator */}
      <div className="rounded-[20px] overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent shadow-[0_24px_48px_-24px_hsl(176_100%_42%_/_0.25)]">
        <div className="px-5 sm:px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shadow-[inset_0_1px_0_hsl(176_100%_60%_/_0.2)]">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">Vision AI Analysis</h2>
                  <span className="text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border text-primary bg-primary/10 border-primary/30 font-semibold">
                    Valu8 exclusive
                  </span>
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/80 mt-0.5">
                  Powered by multimodal vision · {insights.length * 12}+ datapoints scanned
                </div>
              </div>
            </div>
            {totalImpact !== 0 && (
              <div className={cn(
                "tabular-nums font-semibold text-sm rounded-full px-3.5 py-1.5 border backdrop-blur-sm",
                totalImpact > 0 ? "text-primary bg-primary/10 border-primary/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30",
              )}>
                Net {totalImpact > 0 ? "+" : "−"}£{Math.abs(totalImpact).toLocaleString()}
              </div>
            )}
          </div>
          <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed max-w-[60ch] mb-4">
            We scanned every photo for value-affecting details — paint, panel gaps, wheels, interior wear, dashboard signals.
            <span className="text-foreground/85"> AutoTrader, Parkers and AutoUncle don't do this.</span>
          </p>

          {/* Stat strip — bigger, more confident */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-background/40 border border-border/50 px-3 py-3 text-center">
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground leading-none tracking-tight">{insights.length}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1.5">Observations</div>
            </div>
            <div className="rounded-xl bg-primary/[0.08] border border-primary/30 px-3 py-3 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
              <div className="relative text-xl sm:text-2xl font-semibold tabular-nums text-primary leading-none tracking-tight">
                {fixableUpside > 0 ? `+£${fixableUpside.toLocaleString()}` : "—"}
              </div>
              <div className="relative text-[10px] uppercase tracking-[0.12em] text-primary/90 mt-1.5 font-medium">Fixable upside</div>
            </div>
            <div className="rounded-xl bg-background/40 border border-border/50 px-3 py-3 text-center">
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground leading-none tracking-tight">
                {notableCount + minorCount}
                <span className="text-sm text-muted-foreground font-normal"> / {insights.length}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1.5">Need attention</div>
            </div>
          </div>

          {/* Mini-legend */}
          {(positiveCount > 0 || notableCount > 0 || minorCount > 0) && (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-3.5 text-[10.5px] text-muted-foreground">
              {positiveCount > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {positiveCount} value-add{positiveCount === 1 ? "" : "s"}</span>}
              {minorCount > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {minorCount} minor</span>}
              {notableCount > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {notableCount} notable</span>}
            </div>
          )}
        </div>

        {/* Per-photo cards — cinematic grid */}
        <div className="border-t border-border/50 bg-background/30 backdrop-blur-sm p-4 sm:p-5">
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            {orderedKeys.map((idx, cardIdx) => {
              const items = grouped.get(idx)!;
              const url = idx >= 0 ? photoUrls[idx] : undefined;
              const slotKey = items[0]?.slot ?? "other";
              const photoImpact = items.reduce((s, i) => s + (i.priceImpact ?? 0), 0);
              const topSev = items.some(i => i.severity === "notable") ? "notable"
                : items.some(i => i.severity === "minor") ? "minor"
                : items.some(i => i.severity === "positive") ? "positive"
                : "neutral";
              const sevRail =
                topSev === "notable" ? "before:bg-red-400/70"
                : topSev === "minor" ? "before:bg-amber-400/70"
                : topSev === "positive" ? "before:bg-primary/70"
                : "before:bg-border";

              return (
                <div
                  key={idx}
                  className={cn(
                    "group relative rounded-2xl overflow-hidden border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-all duration-300",
                    "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-l-2xl before:transition-colors",
                    sevRail,
                    "animate-fade-in-up",
                  )}
                  style={{ animationDelay: `${Math.min(cardIdx * 60, 360)}ms` }}
                >
                  {/* Large photo with overlays */}
                  {url ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenLightbox?.(idx);
                      }}
                      className="relative block w-full aspect-[4/3] overflow-hidden bg-muted"
                      aria-label={`View ${SLOT_LABELS[slotKey] ?? "photo"} full size`}
                    >
                      <img
                        src={url}
                        alt={SLOT_LABELS[slotKey] ?? "photo"}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      {/* Top gradient + slot pill */}
                      <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
                      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-white">
                        {SLOT_LABELS[slotKey] ?? "Photo"}
                      </div>
                      {/* Bottom gradient + impact + severity dots */}
                      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                      <div className="absolute bottom-2.5 inset-x-2.5 flex items-end justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {items.slice(0, 5).map((it, k) => (
                            <span
                              key={k}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full ring-1 ring-black/30",
                                it.severity === "notable" && "bg-red-400",
                                it.severity === "minor" && "bg-amber-400",
                                it.severity === "positive" && "bg-primary",
                                it.severity === "neutral" && "bg-white/60",
                              )}
                            />
                          ))}
                          {items.length > 5 && (
                            <span className="text-[9.5px] text-white/80 font-medium ml-0.5">+{items.length - 5}</span>
                          )}
                        </div>
                        {photoImpact !== 0 && (
                          <span className={cn(
                            "tabular-nums text-[11px] font-semibold rounded-full px-2 py-0.5 border backdrop-blur-md",
                            photoImpact > 0
                              ? "text-primary bg-primary/15 border-primary/40"
                              : "text-amber-200 bg-amber-500/15 border-amber-400/40",
                          )}>
                            {photoImpact > 0 ? "+" : "−"}£{Math.abs(photoImpact).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="relative w-full aspect-[4/3] bg-muted/30 grid place-items-center">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/70 border border-border/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                        {SLOT_LABELS[slotKey] ?? "Photo"}
                      </div>
                    </div>
                  )}

                  {/* Observations body */}
                  <div className="p-3.5 sm:p-4">
                    <ul className="space-y-2.5">
                      {items.map((ins, k) => (
                        <li key={k}><InsightRow insight={ins} /></li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {(fixableUpside > 0 || totalFixCost > 0) && (
            <div className="mt-5 pt-5 border-t border-border/50 grid sm:grid-cols-2 gap-3">
              {fixableUpside > 0 && (
                <div className="rounded-xl bg-primary/[0.07] border border-primary/30 px-4 py-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent pointer-events-none" />
                  <div className="relative text-[10px] uppercase tracking-[0.14em] text-primary/90 mb-1 font-semibold">Potential upside</div>
                  <div className="relative text-lg font-semibold tabular-nums text-foreground">+£{fixableUpside.toLocaleString()}</div>
                  <div className="relative text-[11px] text-muted-foreground mt-0.5">If you tidy the {fixableCount} fixable item{fixableCount === 1 ? "" : "s"} before listing</div>
                </div>
              )}
              {totalFixCost > 0 && (
                <div className="rounded-xl bg-muted/20 border border-border/60 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1 font-semibold">Estimated fix cost</div>
                  <div className="text-lg font-semibold tabular-nums text-foreground/90">£{totalFixCost.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Indicative trade prices, parts + labour</div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-[10.5px] text-muted-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-primary/70" />
              AI-generated from visible evidence · always verify in person
            </span>
            <span className="text-muted-foreground/60">Tap any photo to view full size</span>
          </div>
        </div>
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
  const iconBg =
    sev === "positive" ? "bg-primary/10 border-primary/25" :
    sev === "notable" ? "bg-red-500/10 border-red-500/25" :
    sev === "minor" ? "bg-amber-500/10 border-amber-500/25" :
    "bg-muted/30 border-border/50";
  return (
    <div className="flex items-start gap-2.5">
      <div className={cn("shrink-0 h-5 w-5 rounded-md border grid place-items-center mt-0.5", iconBg)}>
        <Icon className={cn("h-3 w-3", tone)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug text-foreground/95">{insight.observation}</div>
        {(insight.priceImpact !== undefined || insight.fixCost !== undefined) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {insight.priceImpact !== undefined && insight.priceImpact !== 0 && (
              <span className={cn(
                "inline-flex items-center text-[10.5px] tabular-nums font-semibold rounded-md px-1.5 py-0.5 border",
                insight.priceImpact > 0
                  ? "text-primary bg-primary/10 border-primary/30"
                  : "text-amber-300 bg-amber-500/10 border-amber-500/30",
              )}>
                {insight.priceImpact > 0 ? "+" : "−"}£{Math.abs(insight.priceImpact).toLocaleString()}
              </span>
            )}
            {insight.fixCost !== undefined && insight.fixCost > 0 && (
              <span className="inline-flex items-center text-[10.5px] tabular-nums font-medium rounded-md px-1.5 py-0.5 border border-border/60 bg-muted/30 text-muted-foreground">
                Fix ~£{insight.fixCost.toLocaleString()}
              </span>
            )}
            {insight.fixable && insight.priceImpact !== undefined && insight.priceImpact < 0 && (
              <span className="inline-flex items-center text-[10px] font-semibold rounded-md px-1.5 py-0.5 border border-primary/30 bg-primary/5 text-primary/90 uppercase tracking-[0.12em]">
                Fixable
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

