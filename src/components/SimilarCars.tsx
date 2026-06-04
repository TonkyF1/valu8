import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car, Loader2, ChevronLeft, ChevronRight, MapPin, Gauge, TrendingUp, TrendingDown, Minus, ExternalLink, Info } from "lucide-react";

interface Listing {
  title: string;
  year: number;
  make: string;
  model: string;
  variant?: string;
  mileage: number;
  price: number;
  source: string;
  url?: string;
  imageUrl?: string;
  imageFallbackUrl?: string;
  location?: string;
  relevance?: "very-similar" | "good-match" | "broad";
}

interface Props {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  /** Our valuation (typically private-sale fair price) for inline comparison. */
  valuation?: number;
}

// Normalise marketplace source name -> short badge label + brand colour class.
function sourceBadge(raw: string): { label: string; cls: string } {
  const s = (raw || "").toLowerCase();
  if (s.includes("autotrader")) return { label: "AutoTrader", cls: "bg-[#e63946]/15 text-[#e63946] border-[#e63946]/30" };
  if (s.includes("piston")) return { label: "PistonHeads", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  if (s.includes("motors")) return { label: "Motors", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (s.includes("car & classic") || s.includes("classic")) return { label: "Car & Classic", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s.includes("gumtree")) return { label: "Gumtree", cls: "bg-lime-500/15 text-lime-400 border-lime-500/30" };
  if (s.includes("ebay")) return { label: "eBay", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
  if (s.includes("cazoo")) return { label: "Cazoo", cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" };
  if (s.includes("cinch")) return { label: "Cinch", cls: "bg-pink-500/15 text-pink-400 border-pink-500/30" };
  if (s.includes("heycar")) return { label: "Heycar", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  return { label: raw || "Marketplace", cls: "bg-muted text-muted-foreground border-border/60" };
}

export function SimilarCars({ make, model, variant, year, mileage, valuation }: Props) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("similar-cars", { body: { make, model, variant, year, mileage } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else {
          setListings((data as any)?.listings ?? []);
          setFallback(Boolean((data as any)?.fallback));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [make, model, variant, year, mileage]);

  const avgPrice = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    return Math.round(listings.reduce((s, l) => s + l.price, 0) / listings.length);
  }, [listings]);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Hide the entire section when we don't have enough trustworthy data.
  if (!loading && (error || !listings || listings.length < 3)) {
    return null;
  }

  return (
    <section className="mb-8 animate-fade-in-up">
      <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Similar Cars on the UK Market
          </h2>
          {avgPrice && valuation ? (
            <p className="text-xs text-muted-foreground/80 mt-1">
              Live market average{" "}
              <span className="text-foreground font-semibold tabular-nums">£{avgPrice.toLocaleString()}</span>{" "}
              · Your valuation{" "}
              <span className="text-foreground font-semibold tabular-nums">£{valuation.toLocaleString()}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/80 mt-1">
              Ranked by closeness to your year, mileage and spec.
            </p>
          )}
        </div>
        {listings && listings.length > 2 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll(-1)}
              className="h-8 w-8 grid place-items-center rounded-full border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="h-8 w-8 grid place-items-center rounded-full border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-10 grid place-items-center text-muted-foreground text-sm gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Searching live UK marketplaces…
        </div>
      )}

      {!loading && listings && listings.length >= 3 && (
        <>
          <div
            ref={scrollerRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-subtle pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
            style={{ scrollbarWidth: "thin" }}
          >
            {listings.map((l, i) => {
              const badge = sourceBadge(l.source);
              const diff = valuation ? l.price - valuation : 0;
              const diffPct = valuation ? (diff / valuation) * 100 : 0;
              const diffIcon = !valuation ? null : Math.abs(diffPct) < 2 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
              const diffColor = !valuation
                ? ""
                : Math.abs(diffPct) < 2
                ? "text-muted-foreground"
                : diff > 0
                ? "text-emerald-400"
                : "text-amber-400";

              const relevanceMeta =
                l.relevance === "very-similar"
                  ? { label: "Very similar", cls: "bg-primary/15 text-primary border-primary/30" }
                  : l.relevance === "good-match"
                  ? { label: "Good match", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
                  : null;

              return (
                <a
                  key={i}
                  href={l.url || "#"}
                  target={l.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group flex-shrink-0 snap-start w-[82%] sm:w-[48%] lg:w-[32%] rounded-2xl border border-border/50 bg-card/60 overflow-hidden hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-primary/5 transition-all flex flex-col"
                >
                  <div className="aspect-[16/10] overflow-hidden relative bg-gradient-to-br from-muted/60 via-card to-muted/30">
                    {l.imageUrl ? (
                      <img
                        src={l.imageUrl}
                        alt={`${l.year} ${l.make} ${l.model}`}
                        loading="lazy"
                        data-fallback-url={l.imageFallbackUrl || ""}
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        onError={(e) => {
                          const img = e.currentTarget;
                          const fb = img.getAttribute("data-fallback-url");
                          if (fb && img.src !== fb) {
                            img.removeAttribute("data-fallback-url");
                            img.src = fb;
                            return;
                          }
                          img.style.display = "none";
                          img.parentElement?.querySelector("[data-fallback]")?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      data-fallback
                      className={`absolute inset-0 grid place-items-center text-muted-foreground/30 ${l.imageUrl ? "hidden" : ""}`}
                    >
                      <Car className="h-16 w-16" strokeWidth={1.25} />
                    </div>
                    <span className={`absolute top-2.5 left-2.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full backdrop-blur-sm border ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {relevanceMeta && (
                      <span className={`absolute bottom-2.5 left-2.5 text-[10px] font-medium px-2 py-1 rounded-full backdrop-blur-sm border ${relevanceMeta.cls}`}>
                        {relevanceMeta.label}
                      </span>
                    )}
                    {l.url && (
                      <span className="absolute top-2.5 right-2.5 h-6 w-6 grid place-items-center rounded-full bg-background/80 backdrop-blur-sm border border-border/60 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="text-sm font-semibold leading-snug line-clamp-2">
                      {l.year} {l.make} {l.model}
                    </div>
                    {l.variant && (
                      <div className="text-[11px] text-muted-foreground line-clamp-1">{l.variant}</div>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {l.mileage.toLocaleString()} mi
                      </span>
                      {l.location && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{l.location}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="text-xl font-bold tabular-nums text-gradient-primary">
                        £{l.price.toLocaleString()}
                      </div>
                      {valuation && diffIcon && (
                        <div className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${diffColor}`}>
                          {(() => { const Icon = diffIcon; return <Icon className="h-3 w-3" />; })()}
                          {diff > 0 ? "+" : ""}
                          {diffPct.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        Live market data from UK classifieds. Prices can change quickly.
      </p>
    </section>
  );
}

