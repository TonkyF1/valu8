import { sumPhotoImpacts } from "../../supabase/functions/_shared/pricing";
import { hasPhotos, normaliseReportPricing } from "@/lib/askingPrice";
import { fixableUpside as computeFixableUpside } from "../../supabase/functions/_shared/photo-insights";
import { marketConfidenceTier } from "../../supabase/functions/_shared/pricing";
import { shareLink } from "@/lib/retention";
import { useSeo } from "@/lib/seo";
import { posthog } from "@/lib/posthog";
import { displayMake, displayModel, normaliseFuel, vehicleTitle } from "../../supabase/functions/_shared/vehicle-text";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ConditionGauge } from "@/components/ConditionGauge";
import { AdvertCreator } from "@/components/AdvertCreator";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { VehicleInsights, SectionBoundary } from "@/components/VehicleInsights";

import type { ValuationReport, PhotoInsight } from "@/lib/valuation";
import { format } from "date-fns";
import {
  Share2, Download, Check, ShieldCheck, AlertTriangle, ArrowLeft,
  Star, Pencil, ChevronDown, MoreHorizontal, Sparkles, Camera, TrendingUp, TrendingDown, Minus,
  Megaphone, FileCheck2, X, Calculator, ChevronLeft, ChevronRight, History,
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
import { cleanReportText, marketCountLine } from "@/lib/reportText";
import { explainValuation } from "@/lib/valuationExplainer";
import { HowWeValue } from "@/components/HowWeValue";
import { SaleFeedbackCard } from "@/components/SaleFeedbackCard";
import { stripSaleFeedback } from "@/lib/saleFeedback";
import { useAuth } from "@/contexts/AuthContext";
import { getSaleFeedback } from "@/lib/saleFeedback";
import { GuestSavePrompt } from "@/components/report/GuestSavePrompt";
import { claimGuestValuations, clearReturnTo, isGuestValuation, setReturnTo } from "@/lib/guest";
import { priceBandGeometry } from "@/lib/priceBand";
import { ReportNav, SoldItPrompt, useReportSections } from "@/components/report/ReportNav";
import { MiniTier, Section, CollapsibleSection, RecBlock, SLOT_LABELS, PhotoFeedback, InsightRow } from "@/components/report/ReportParts";

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
  const { user, loading: authLoading } = useAuth();
  // Guest = no account; their own report is read via the share endpoint (unguessable UUID).
  const isGuest = !isShared && !authLoading && !user;
  const [v, setV] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [showOldAdvisories, setShowOldAdvisories] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const { sections: navSections, active: navActive } = useReportSections(!loading && !!v, `${v?.id}-${user?.id}-${!!getSaleFeedback(v?.report)}`);

  useEffect(() => {
    if (!id) return;
    if (!isShared && authLoading) return;
    if (isShared || !user) {
      // Public share view: fetch via edge function which signs photo URLs server-side.
      supabase.functions.invoke("get-shared-valuation", { body: { id } })
        .then(({ data, error }) => {
          if (!error && data && !(data as any).error) {
            const d = data as any;
            setV({ ...d, photo_urls: Array.isArray(d.photo_urls) ? d.photo_urls.filter(Boolean) : [], report: stripSaleFeedback(d.report) as ValuationReport });
            document.title = `${d.year} ${d.make} ${d.model} — Valu8`;
          }
          setLoading(false);
        });
      return;
    }
    const loadOwn = () => supabase.from("valuations").select("*").eq("id", id).maybeSingle();
    loadOwn()
      .then(async (res) => {
        let data = res.data;
        // Just signed up/in from a guest report: claim it into the account, then reload.
        if (!data && isGuestValuation(id)) {
          await claimGuestValuations(user!.id);
          data = (await loadOwn()).data;
        }
        clearReturnTo();
        if (data) {
          const refs = Array.isArray(data.photo_urls) ? (data.photo_urls as string[]) : [];
          // Refresh signed URLs on every load so photos always render even after expiry.
          const signed = refs.length > 0 ? (await signPhotoUrls(refs)).filter(Boolean) : [];
          setV({ ...(data as any), photo_urls: signed, report: data.report as unknown as ValuationReport });
          document.title = `${vehicleTitle({ year: data.year, make: data.make, model: data.model, engineCapacity: (data.report as any)?.vehicle?.engineCapacity, fuelType: (data.report as any)?.vehicle?.fuelType })} — Valu8`;
        }
        setLoading(false);
      });
  }, [id, isShared, authLoading, user?.id]);

  const seoVehicle = v ? `${v.year} ${displayMake(v.make)} ${displayModel(v.model)}` : "Car";
  const seoValue = v && !(v.report as any)?.valuationUnavailable && v.report?.values?.privateSale ? ` Private sale estimate £${Math.round(v.report.values.privateSale).toLocaleString("en-GB")}.` : "";
  useSeo({
    title: `${seoVehicle} valuation | Valu8`,
    description: isShared
      ? `Independent Valu8 valuation for this ${seoVehicle}, ${v ? `${v.mileage.toLocaleString("en-GB")} miles` : ""}.${seoValue} Based on UK advert data, DVSA MOT history and photo condition.`
      : `Your Valu8 valuation report for this ${seoVehicle}.`,
    path: location.pathname,
    noindex: true,
  });


  useEffect(() => {
    if (!v) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    supabase.functions
      .invoke("marketcheck-count", {
        body: { make: v.make, model: v.model, year: v.year },
      })
      .then(({ data, error }) => {
        if (error || (data as any)?.error) return;
        const n = Number((data as any)?.totalCount);
        if (Number.isFinite(n)) setLiveCount(n);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [v]);



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
        <main id="main" className="flex-1 container py-6 md:py-8 max-w-5xl">
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
            <Button asChild variant="hero" className="mt-6"><Link to={user ? "/dashboard" : "/valuation/new"}>{user ? "Back to dashboard" : "Value a car free"}</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  // Latest DVSA expiry wins over the seller-entered field.
  const motExpiryForText = (v.report as any)?.motHistory?.[0]?.expiryDate ?? v.mot_expiry;
  const r = cleanReportText(v.report, motExpiryForText);
  const fuelDisplay = normaliseFuel((r as any).vehicle?.fuelType);
  if ((r as any).vehicle) (r as any).vehicle = { ...(r as any).vehicle, fuelType: fuelDisplay };
  const modelDisplay = displayModel(v.make, v.model, fuelDisplay);
  const makeDisplay = displayMake(v.make);
  const titleDisplay = vehicleTitle({ year: v.year, make: v.make, model: v.model, engineCapacity: (r as any).vehicle?.engineCapacity, fuelType: fuelDisplay });
  const sampleSize = (r as any).marketSampleSize ?? (r as any).marketBaseline?.sampleSize ?? null;
  const countLine = marketCountLine(liveCount, sampleSize);
  const valuationUnavailable = !!r.valuationUnavailable;
  // Honest source labelling: only claim live listings when the engine actually used them.
  const isLiveListings = r.pricingSource === "marketcheck" || (!r.pricingSource && !!(r as any).marketBaseline);
  const isEstimate = !isLiveListings;
  const marketSourceLabel = isLiveListings ? "MarketCheck UK live pricing" : "AI market estimate";
  // Missing live data is a "limited data" situation, not proof the car is too rare.
  const limitedData = valuationUnavailable && isEstimate && !r.rareCarWarning;

  // Live market confidence derived from MarketCheck total count.
  // If API fails/pending -> liveCount is null. Default to LOW silently.
  // One source of truth: the confidence stored with the valuation (v2.2+), else
  // the same sample-size thresholds the engine uses. Very Low shows as Low.
  const storedTier = (r as any).engineVersion === "v2.2-ledger" ? r.marketConfidence : undefined;
  const computedTier = storedTier ?? marketConfidenceTier({ sampleSize: Number(sampleSize ?? liveCount ?? 0) });
  const liveTier: "High" | "Medium" | "Low" = computedTier === "High" ? "High" : computedTier === "Medium" ? "Medium" : "Low";

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
  if (liveCount != null && liveCount < 15) rarityReasons.push("very few comparable cars are on the UK market");
  if (carAge >= 25) rarityReasons.push("its age puts it into modern-classic territory");
  if (carAge <= 0 && liveCount != null && liveCount < 60) rarityReasons.push("it's a brand-new model with very limited resale data");
  if (mileageRatio < 0.25) rarityReasons.push("it has exceptionally low mileage for its age");
  if (mileageRatio > 2.8) rarityReasons.push("it has an unusually high mileage profile");
  if (r.rareCarWarning) rarityReasons.push("of its rare specification or trim");
  if (aiConfidence === "Very Low") rarityReasons.push("our AI flagged it as a harder-than-average car to price");

  // Trigger expert overlay ONLY when the car is genuinely difficult to price.
  const strongSingleSignal =
    (liveCount != null && liveCount < 3) ||
    !!r.rareCarWarning ||
    aiConfidence === "Very Low";
  const showSpecialistBadge =
    !!r.expertInsight?.shown ||
    (strongSingleSignal && rarityReasons.length >= 1) ||
    rarityReasons.length >= 3;

  const liveConfidenceLine = !isLiveListings
    ? "An estimate built from our UK advert database and AI market analysis, not live listings."
    : liveTier === "High"
      ? "Priced from a deep pool of live UK listings — a well-supported valuation."
      : liveTier === "Medium"
      ? "Based on a healthy sample of similar cars on the market right now."
      : "Fewer live comparables right now — treat this as a strong estimate rather than a precise figure.";

  const specialistExplanation = (() => {
    if (!showSpecialistBadge) return null;
    // Prefer the server-provided reason — it knows exactly which data sources fed the valuation.
    if (r.expertInsight?.reason) return r.expertInsight.reason;
    const top = rarityReasons.slice(0, 2);
    if (top.length === 0) {
      return `We've layered expert analysis on top of ${isLiveListings ? "live market data" : "our AI market estimate"} to give you a confident figure on a harder-than-average car to price.`;
    }
    if (top.length === 1) {
      return `Because ${top[0]}, we've layered expert analysis on top of ${isLiveListings ? "live market data" : "our AI market estimate"} to give you a confident figure.`;
    }
    return `Because ${top[0]} and ${top[1]}, we've layered expert analysis on top of ${isLiveListings ? "live market data" : "our AI market estimate"} to give you a confident figure.`;
  })();

  const share = async () => {
    const shareUrl = `${window.location.origin}/shared/${v?.id ?? id}`;
    const res = await shareLink(shareUrl, `${v?.year} ${v?.make} ${v?.model} valuation — Valu8`, "Here's the independent Valu8 valuation for this car:");
    if (res === "copied") toast.success("Link copied", { description: "Send it to your buyer. They'll see the report without your account details." });
    else if (res === "failed") toast.error("Couldn't copy link", { description: shareUrl });
    posthog.capture?.("Report Shared", { method: res });
  };

  const downloadPdf = async () => {
    const tid = toast.loading("Generating PDF…");
    try {
      await (await import("@/lib/pdf")).downloadValuationPdf(v, r, { shareUrl: `${window.location.origin}/shared/${v.id}` });
      toast.success("Report downloaded successfully", { id: tid });
    } catch (err) {
      console.error("PDF download failed", err);
      toast.error("Couldn't generate PDF", { id: tid, description: "Please try again.", action: { label: "Retry", onClick: () => { void downloadPdf(); } } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container py-6 md:py-8 pb-28 sm:pb-8 max-w-5xl lg:max-w-6xl">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          {isShared || isGuest ? (
            <Button asChild variant="ghost" size="sm" className="min-h-[44px] sm:min-h-0">
              <Link to={isGuest ? "/valuation/new" : "/"}><ArrowLeft className="h-4 w-4" /> {isGuest ? "New valuation" : "Valu8"}</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="min-h-[44px] sm:min-h-0">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> All valuations</Link>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="premium"
              size="sm"
              onClick={downloadPdf}
              className={cn("min-h-[44px] sm:min-h-0", !isShared && "hidden sm:inline-flex")}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
            {!isShared && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More actions" className="h-11 w-11 sm:h-10 sm:w-10">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => {
                    if (isGuest) {
                      setReturnTo(`/valuation/${v.id}`);
                      toast.message("Create a free account to edit", { description: "Your report is saved to your account automatically." });
                      navigate("/auth?mode=signup");
                      return;
                    }
                    navigate(`/valuation/${v.id}/edit`);
                  }}>
                    <Pencil className="h-4 w-4" /> Edit valuation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={share}>
                    <Share2 className="h-4 w-4" /> Share with buyer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    import("@/lib/shareCard")
                      .then((m) => m.shareReportImage(v, r, `${window.location.origin}/shared/${v.id}`))
                      .then((res) => { if (res === "downloaded") toast.success("Share image downloaded"); })
                      .catch(() => toast.error("Couldn't create share image"));
                  }}>
                    <Camera className="h-4 w-4" /> Share as image
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>


        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-10">
        <div className="min-w-0">
        {/* Title */}
        <div className="mb-6 animate-fade-in-up">
          <div className="text-xs  text-primary font-semibold mb-1.5">Valuation report</div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-gradient">
            {titleDisplay}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span>{v.mileage.toLocaleString()} miles</span>
            {v.registration && <><span>•</span><span className="font-mono uppercase">{v.registration}</span></>}
            <span>•</span><span>{format(new Date(v.created_at), "d MMM yyyy")}</span>
            {(r as any).edited && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold ">
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
          <p className="mt-3 text-[11px] text-muted-foreground/60 max-w-[60ch]">
            AI-assisted estimate. See full disclaimers below.
          </p>
        </div>

        {/* Sticky summary — keeps the headline figure in view while reading the detail */}
        {!valuationUnavailable && (
          <div className="sticky top-16 z-30 -mx-4 sm:mx-0 mb-4 border-y sm:border sm:rounded-xl border-border/60 bg-background/85 backdrop-blur-xl px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{titleDisplay}</p>
              <p className="text-xs text-muted-foreground">{v.mileage.toLocaleString("en-GB")} miles{v.registration ? ` · ${v.registration.toUpperCase()}` : ""}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-medium text-muted-foreground">Private sale <span className="rounded border border-border px-1 py-px ml-0.5">Estimate</span></p>
              <p className="text-lg font-bold tabular-nums text-primary">£{Math.round(normaliseReportPricing(r).privateSale).toLocaleString("en-GB")}</p>
            </div>
            </div>
            <div className="lg:hidden"><ReportNav variant="chips" sections={navSections} active={navActive} /></div>
          </div>
        )}

        <div id="r-summary" className="scroll-mt-44" />
        {/* Quick Summary — confident verdict + scannable bullets + trust strip */}
        {!valuationUnavailable && (() => {
          const verdict = !hasPhotos(v.photo_urls)
              ? { label: "Sell privately", tone: "primary" as const, line: "A private sale usually gets the most money. Add photos to get a condition score and a sharper price." }
              : r.conditionScore >= 8
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
                    <h2 className="text-xs font-semibold  text-primary">Quick summary</h2>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs  font-semibold px-2.5 py-1 rounded-full border",
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
                      Realistic private sale (estimate): <strong className="tabular-nums text-foreground">£{r.values.privateSale.toLocaleString()}</strong>
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      {hasPhotos(v.photo_urls) ? (
                        <>Condition: <strong className="text-foreground">{r.conditionLabel}</strong>
                        <span className="text-muted-foreground"> · {r.conditionScore}/10</span></>
                      ) : (
                        <>Condition: <span className="text-muted-foreground">add photos for a condition score</span></>
                      )}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <span className="text-foreground/90">
                      Market: <strong className="text-foreground">{showSpecialistBadge ? "Expert insight" : `${liveTier} confidence`}</strong>
                      {liveCount != null && liveCount > 0 && <span className="text-muted-foreground"> · {liveCount.toLocaleString()} similar cars for sale in the UK</span>}
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
                <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> DVSA MOT history</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> {marketSourceLabel}</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> AI vision condition</span>
                </div>
              </div>
            </section>
          );
        })()}




        {isEstimate && !valuationUnavailable && (
          <div role="note" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
            <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-300">Estimate</span>
            <span>AI market estimate: live listings were unavailable for this car, so treat this as a guide.</span>
          </div>
        )}

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
                    <img src={u} alt={`${v.make} ${v.model} thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <div id="r-price" className="scroll-mt-44" />
        {/* Hero: Private Sale headline + Condition + small tiers */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
          {/* Headline private sale price */}
          <div className="lg:col-span-3 premium-card p-5 sm:p-6 relative overflow-hidden border-primary/30">
            <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-20 w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />

            {/* Eyebrow + confidence pill */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap relative">
              <span className="text-xs  text-muted-foreground font-medium">
                {valuationUnavailable ? "Valuation status" : "Realistic Private Sale Price"}
              </span>
              {!valuationUnavailable && (
                showSpecialistBadge ? (
                  <span className="inline-flex items-center gap-1.5 text-xs  px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/30 font-semibold">
                    <ShieldCheck className="h-3 w-3" /> Expert insight
                  </span>
                ) : (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs  px-2.5 py-1 rounded-full border font-semibold",
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
                  {limitedData ? "Limited data for this car" : "Unable to value accurately"}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                  {r.valueReasoning || r.honestAnalysis}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Headline price — bigger, tighter, more Apple */}
                <div className="text-5xl sm:text-6xl font-semibold tabular-nums text-gradient-primary leading-[0.95] tracking-tight">
                  <CountUp value={normaliseReportPricing(r).privateSale} prefix="£" />
                </div>
                <p className="text-[12px] text-muted-foreground mt-2 max-w-[44ch]">
                  Our estimate of a realistic private sale in today's UK market.
                </p>

                {/* Live data ticker */}
                {liveCount != null && liveCount > 0 && (
                  <div className="mt-2.5 inline-flex items-center gap-2 text-[11.5px] text-muted-foreground/90">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <span>{countLine}</span>
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
                      <div className="text-xs  text-primary font-semibold mb-1">
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
                    <div className="text-xs  text-muted-foreground font-semibold mb-1.5">
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
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs  font-semibold text-primary/90 hover:text-primary">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  Why this price
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-[1.6] text-[#E8E8E8]">
                    {r.headline ? (
                      r.headline
                    ) : (
                      <>
                        {isLiveListings ? "Based on live UK market data" : "Based on our AI market estimate"}, a realistic figure for this {v.year} {makeDisplay} {modelDisplay} sits around{" "}
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
              const cp = normaliseReportPricing(r);
              const { askLow: rangeLow, askHigh: rangeHigh, buffer, privateLow: marketLow, privateHigh: marketHigh } = cp;
              // Slider scale always spans trade-in → retail.
              const trackLow = cp.scaleLow;
              const trackHigh = cp.scaleHigh;
              const band = priceBandGeometry({
                scaleLow: trackLow, scaleHigh: trackHigh,
                privateLow: marketLow, privateHigh: marketHigh,
                askLow: rangeLow, askHigh: rangeHigh, privateSale: cp.privateSale,
              });
              return (
                <div className="mt-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent px-4 py-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs  text-primary/90 font-semibold">Suggested asking price</span>
                    {!isShared && <span className="text-[11px] tabular-nums text-muted-foreground">Negotiation buffer ~£{buffer.toLocaleString()}</span>}
                  </div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums text-foreground leading-none tracking-tight">
                    £{rangeLow.toLocaleString()} – £{rangeHigh.toLocaleString()}
                  </div>

                  {/* Price band visualization */}
                  <div className="mt-5 mb-1">
                    <div className="relative h-9">
                      {/* base track */}
                      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-muted/40" />
                      {/* asking range (outlined, behind) */}
                      <div
                        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border border-dashed border-foreground/40"
                        style={{ left: `${band.ask.left}%`, width: `${band.ask.width}%` }}
                        aria-label="Your suggested asking range"
                      />
                      {/* private-sale range: green pill that always contains the marker */}
                      <div
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_12px_hsl(176_100%_42%_/_0.5)]"
                        style={{ left: `${band.pill.left}%`, width: `${band.pill.width}%` }}
                        aria-label="Estimated private-sale range"
                        data-testid="band-pill"
                      />
                      {/* realistic sale marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${band.marker}%` }}
                        data-testid="band-marker"
                      >
                        <span className="h-3.5 w-3.5 rounded-full bg-background border-2 border-primary shadow-[0_0_0_3px_hsl(176_100%_42%_/_0.18)]" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] tabular-nums text-muted-foreground/80">
                      <span>Trade-in £{trackLow.toLocaleString()}</span>
                      <span>Retail £{trackHigh.toLocaleString()}</span>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-primary" /> Est. private range</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full border border-dashed border-foreground/50" /> Ask range</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-primary bg-background" /> Realistic sale</span>
                    </div>
                  </div>

                  <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed max-w-[48ch]">
                    Where you land depends on photos, history file and how quickly you need to sell. Our estimated private-sale range for this car is <span className="tabular-nums text-foreground/85">£{marketLow.toLocaleString()}</span> to <span className="tabular-nums text-foreground/85">£{marketHigh.toLocaleString()}</span>.
                  </p>
                </div>
              );
            })()}

            {/* Pro Tip — negotiation guidance (seller-only; hidden on buyer share links) */}
            {!valuationUnavailable && !isShared && (
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs  font-semibold text-amber-300/90 hover:text-amber-300">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  💡 Pro tip — listing & offers
                </summary>
                {(() => {
                  const cp = normaliseReportPricing(r);
                  const listAt = cp.askHigh;
                  const offerLow = cp.privateLow;
                  const offerHigh = Math.max(cp.privateSale, cp.askLow);
                  return (
                    <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.55] text-[#E8E8E8]">
                      <li>• List at <strong className="tabular-nums">£{listAt.toLocaleString()}</strong> — small head-room without scaring buyers.</li>
                      <li>• Expect offers between <strong className="tabular-nums">£{offerLow.toLocaleString()}–£{offerHigh.toLocaleString()}</strong>.</li>
                      <li>• Don't drop below <strong className="tabular-nums">£{cp.privateSale.toLocaleString()}</strong> unless you need a fast sale.</li>
                    </ul>
                  );
                })()}
              </details>
            )}

            {!valuationUnavailable && liveCount == null && (
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Valued using AI market analysis and our UK advert database.
              </p>
            )}
            {!valuationUnavailable && (
              <div className="grid grid-cols-2 gap-2 mt-5 pt-5 border-t border-border/60">
                <MiniTier label="Trade-in" tag="Estimate" tip="Our estimate of what a dealer would pay you today. Fastest, lowest." value={normaliseReportPricing(r).tradeIn} />
                <MiniTier label="Retail" tag="Estimate" tip="Our estimate of a dealer forecourt price. Includes their margin." value={normaliseReportPricing(r).retail} />
              </div>
            )}
          </div>

          {/* Condition score / specialist guidance */}
          <div className="lg:col-span-2 premium-card py-6 px-5 flex flex-col items-center justify-center text-center">
            {valuationUnavailable ? (
              <>
                <div className="text-xs  text-muted-foreground mb-4">Recommended route</div>
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300">
                  {limitedData ? "Limited data" : "Specialist / auction"}
                </div>
                <p className="text-[11px] text-muted-foreground mt-4 max-w-[220px] leading-relaxed">
                  {limitedData
                    ? "Live listings were unavailable for this car, so we don't have enough data for a confident figure yet. Try again later, or ask a specialist dealer for a second opinion."
                    : "Cars like this are too rare for our system to value accurately. A specialist dealer or auction house will give you a much better idea."}
                </p>
              </>
            ) : (
              <>
                <div className="text-xs  text-muted-foreground mb-4">Condition score</div>
                {hasPhotos(v.photo_urls) ? (
                  <>
                    <div className="w-full max-w-[280px]">
                      <ConditionGauge score={r.conditionScore} label={r.conditionLabel} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-4 max-w-[200px] leading-relaxed">
                      Based on photos, mileage and history.
                    </p>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground/60 mb-3" aria-hidden />
                    <p className="text-sm text-foreground/90 max-w-[220px] leading-relaxed">No photos uploaded, so we haven't scored condition.</p>
                    {!isShared && !isGuest && (
                      <Button asChild variant="outline" size="sm" className="mt-4 min-h-[44px]">
                        <Link to={`/valuation/${v.id}/edit`}>Add photos for a condition score</Link>
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>


        {!isShared && user && (v as any).user_id === user.id && !valuationUnavailable && !getSaleFeedback(v.report) && <SoldItPrompt />}
        {isGuest && <GuestSavePrompt valuationId={v.id} />}
        <div id="r-details" className="scroll-mt-44" />
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


        {/* Transparency: how the number was built, from stored figures only */}
        {(() => {
          const ex = explainValuation(r, { year: v.year, mileage: v.mileage });
          if (!ex) return null;
          return (
            <CollapsibleSection title="How we value your car" icon={Calculator} preview="Comparables, mileage and age corrections, and adjustments in plain English">
              <HowWeValue ex={ex} />
            </CollapsibleSection>
          );
        })()}

        {/* Per-photo AI feedback — our moat made visible */}
        {r.photoInsights && r.photoInsights.length > 0 && v.photo_urls.length > 0 && (
          <PhotoFeedback insights={r.photoInsights} photoUrls={v.photo_urls} onSelectPhoto={setActivePhoto} onOpenLightbox={setLightboxIndex} />
        )}

        {/* What If Simulator — toggle fixable issues to see the upside */}
        {!valuationUnavailable && !isShared && r.photoInsights && r.photoInsights.length > 0 && (
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
                  <span className="text-[11px] font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-2 py-0.5">
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
                    <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                      {currentAdvisories.length}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
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
                  <h2 className="text-sm font-semibold text-muted-foreground">Previously rectified advisories</h2>
                  <span className="text-[11px] text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">{oldAdvisories.length}</span>
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
                        <span className="text-[11px] text-emerald-400/80 ml-auto shrink-0">Fixed on latest MOT</span>
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
              <span className="text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">
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

        <div id="r-mot" className="scroll-mt-44" />
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
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border text-primary bg-primary/5 border-primary/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Live DVSA
                    </span>
                  )}
                  {r.motHistory.length > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/40 rounded-full px-2 py-0.5">
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
                            "text-xs font-semibold ",
                            m.result === "Pass" ? "text-primary" : m.result === "Advisory" ? "text-amber-400" : "text-destructive"
                          )}>{m.result}</span>
                          <span className="font-medium text-sm">{format(new Date(m.date), "d MMM yyyy")}</span>
                          {m.expiryDate && m.result !== "Fail" && (
                            <span className="text-[11px] text-muted-foreground">· Expires {new Date(m.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
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


        {/* Sale feedback: placed after the detail sections (end of the reading flow) so it does not interrupt the report; real sale prices power /accuracy */}
        {!isShared && user && (v as any).user_id === user.id && (
          <SectionBoundary>
            <SaleFeedbackCard
              valuationId={v.id}
              report={v.report}
              estimate={(v.report as any)?.valuationUnavailable ? null : v.report?.values?.privateSale ?? null}
              onSaved={(next) => setV((prev) => (prev ? { ...prev, report: next as unknown as ValuationReport } : prev))}
            />
          </SectionBoundary>
        )}

        <div id="r-ownership" className="scroll-mt-44" />
        <SectionBoundary>
          <VehicleInsights
            report={r}
            vehicle={{ make: v.make, model: v.model, year: v.year, mileage: v.mileage, mot_expiry: v.mot_expiry, service_notes: (v as any).service_notes ?? null }}
            isShared={isShared}
          />
        </SectionBoundary>

        {isGuest && (
          <div id="advert" className="scroll-mt-44">
            <GuestSavePrompt
              valuationId={v.id}
              variant="inline"
              reason="Create a free account to write your advert from this report, track your car's value and tell us what it sold for. Your report comes with you."
            />
          </div>
        )}

        {!valuationUnavailable && !isShared && !isGuest && (
          <>


            <div id="advert" className="scroll-mt-44">
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
            </div>
          </>
        )}

        <footer className="mt-12 pt-6 border-t border-border/40">
          <div className="text-xs text-muted-foreground/60 font-semibold mb-2">Legal</div>
          <p className="text-xs leading-relaxed text-muted-foreground/70">
            Sources: {isLiveListings ? "MarketCheck UK live listings" : "AI market estimate (live listings unavailable)"}, DVSA MOT history, AI photo analysis. Estimates are for guidance only — not financial advice or a guaranteed sale price. Always verify vehicle history and MOT independently before transacting.
          </p>
        </footer>
        </div>
        <aside className="hidden lg:block">
          <ReportNav variant="sidebar" sections={navSections} active={navActive} />
        </aside>
        </div>
      </main>
      {/* Sticky mobile CTA */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isShared ? (
          <Button asChild variant="hero" size="lg" className="w-full min-h-[48px]">
            <Link to="/valuation/new">Value your own car free</Link>
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={downloadPdf} aria-label="Download PDF"><Download className="h-4 w-4" aria-hidden /></Button>
            <Button variant="outline" size="lg" className="flex-1 min-h-[48px] px-3" onClick={share}><Share2 className="h-4 w-4" aria-hidden /> Share</Button>
            {isGuest ? (
              <Button asChild variant="hero" size="lg" className="flex-1 min-h-[48px] px-3"><Link to="/auth?mode=signup" onClick={() => setReturnTo(`/valuation/${v.id}`)}>Save report</Link></Button>
            ) : !valuationUnavailable && (
              <Button asChild variant="hero" size="lg" className="flex-1 min-h-[48px] px-3"><a href="#advert"><Megaphone className="h-4 w-4" aria-hidden /> Write advert</a></Button>
            )}
          </div>
        )}
      </div>
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs  text-white/70 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
            {lightboxIndex + 1} / {v.photo_urls.length}
          </div>
        </div>
      )}
    </div>
  );
}
