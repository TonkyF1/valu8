/* Presentational building blocks for the valuation report (split out of pages/Report.tsx). */
import { sumPhotoImpacts } from "../../../supabase/functions/_shared/pricing";
import { hasPhotos, normaliseReportPricing } from "@/lib/askingPrice";
import { fixableUpside as computeFixableUpside } from "../../../supabase/functions/_shared/photo-insights";
import { marketConfidenceTier } from "../../../supabase/functions/_shared/pricing";
import { shareLink } from "@/lib/retention";
import { useSeo } from "@/lib/seo";
import { posthog } from "@/lib/posthog";
import { displayMake, displayModel, normaliseFuel, vehicleTitle } from "../../../supabase/functions/_shared/vehicle-text";
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


export function MiniTier({ label, tag, tip, value }: { label: string; tag: string; tip?: string; value: number }) {
  const inner = (
    <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5 transition-colors hover:border-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs  text-muted-foreground">{label}</span>
        <span className="text-xs  text-muted-foreground/70">{tag}</span>
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

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {right}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/50 p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

export function CollapsibleSection({
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
                  "text-[15px] font-semibold tracking-tight transition-colors",
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
          {/* Collapsed content is hidden from reading/copy/assistive tech so the preview line isn't read twice. */}
          <div className="overflow-hidden" aria-hidden={!open} {...(!open ? { inert: "" } : {})} style={open ? undefined : { visibility: "hidden" }}>
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RecBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs  text-muted-foreground mb-3 font-medium">{title}</div>
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

export const SLOT_LABELS: Record<string, string> = {
  front: "Front 3/4",
  rear: "Rear 3/4",
  side: "Side profile",
  interior: "Interior",
  odometer: "Odometer",
  engine: "Engine bay",
  other: "Other photo",
};

export function PhotoFeedback({
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

  const totalImpact = sumPhotoImpacts(insights);
  const totalFixCost = insights.reduce((sum, i) => sum + (i.fixable ? (i.fixCost ?? 0) : 0), 0);
  // Computed from the validated line items — never an AI-supplied figure.
  const fixableUpside = computeFixableUpside(insights);

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
                  <span className="text-xs  px-2 py-0.5 rounded-full border text-primary bg-primary/10 border-primary/30 font-semibold">
                    Valu8 exclusive
                  </span>
                </div>
                <div className="text-xs  text-muted-foreground/80 mt-0.5">
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
          </p>

          {/* Stat strip — bigger, more confident */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-background/40 border border-border/50 px-3 py-3 text-center">
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground leading-none tracking-tight">{insights.length}</div>
              <div className="text-xs  text-muted-foreground mt-1.5">Observations</div>
            </div>
            <div className="rounded-xl bg-primary/[0.08] border border-primary/30 px-3 py-3 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
              <div className="relative text-xl sm:text-2xl font-semibold tabular-nums text-primary leading-none tracking-tight">
                {fixableUpside > 0 ? `+£${fixableUpside.toLocaleString()}` : "£0"}
              </div>
              <div className="relative text-xs  text-primary/90 mt-1.5 font-medium">Fixable upside</div>
            </div>
            <div className="rounded-xl bg-background/40 border border-border/50 px-3 py-3 text-center">
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground leading-none tracking-tight">
                {notableCount + minorCount}
                <span className="text-sm text-muted-foreground font-normal"> / {insights.length}</span>
              </div>
              <div className="text-xs  text-muted-foreground mt-1.5">Need attention</div>
            </div>
          </div>

          {/* Mini-legend */}
          {(positiveCount > 0 || notableCount > 0 || minorCount > 0) && (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-3.5 text-[11px] text-muted-foreground">
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
              const photoImpact = sumPhotoImpacts(items);
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
                      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 px-2.5 py-1 text-xs  font-semibold text-white">
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
                            <span className="text-[11px] text-white/80 font-medium ml-0.5">+{items.length - 5}</span>
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
                      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/70 border border-border/60 px-2.5 py-1 text-xs  font-semibold text-muted-foreground">
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
                  <div className="relative text-xs  text-primary/90 mb-1 font-semibold">Potential upside</div>
                  <div className="relative text-lg font-semibold tabular-nums text-foreground">+£{fixableUpside.toLocaleString()}</div>
                  <div className="relative text-[11px] text-muted-foreground mt-0.5">If you tidy the {fixableCount} fixable item{fixableCount === 1 ? "" : "s"} before listing</div>
                </div>
              )}
              {totalFixCost > 0 && (
                <div className="rounded-xl bg-muted/20 border border-border/60 px-4 py-3">
                  <div className="text-xs  text-muted-foreground mb-1 font-semibold">Estimated fix cost</div>
                  <div className="text-lg font-semibold tabular-nums text-foreground/90">£{totalFixCost.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Indicative trade prices, parts + labour</div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-[11px] text-muted-foreground/80">
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

export function InsightRow({ insight }: { insight: PhotoInsight }) {
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
                "inline-flex items-center text-[11px] tabular-nums font-semibold rounded-md px-1.5 py-0.5 border",
                insight.priceImpact > 0
                  ? "text-primary bg-primary/10 border-primary/30"
                  : "text-amber-300 bg-amber-500/10 border-amber-500/30",
              )}>
                {insight.priceImpact > 0 ? "+" : "−"}£{Math.abs(insight.priceImpact).toLocaleString()}
              </span>
            )}
            {insight.fixCost !== undefined && insight.fixCost > 0 && (
              <span className="inline-flex items-center text-[11px] tabular-nums font-medium rounded-md px-1.5 py-0.5 border border-border/60 bg-muted/30 text-muted-foreground">
                Fix ~£{insight.fixCost.toLocaleString()}
              </span>
            )}
            {insight.fixable && insight.priceImpact !== undefined && insight.priceImpact < 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold rounded-md px-1.5 py-0.5 border border-primary/30 bg-primary/5 text-primary/90 uppercase tracking-wider">
                Fixable
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

