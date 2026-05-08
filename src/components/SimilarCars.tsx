import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

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
}

interface Props {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
}

export function SimilarCars({ make, model, variant, year, mileage }: Props) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        else setListings((data as any)?.listings ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [make, model, variant, year, mileage]);

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Similar Cars Currently For Sale on UK Marketplaces
        </h2>
        {listings && listings.length > 3 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll(-1)}
              className="h-7 w-7 grid place-items-center rounded-full border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="h-7 w-7 grid place-items-center rounded-full border border-border/60 bg-card/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
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
          Finding comparable listings…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
          Couldn't load similar listings right now.
        </div>
      )}

      {!loading && !error && listings && listings.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 text-sm text-muted-foreground">
          No close comparables found.
        </div>
      )}

      {!loading && listings && listings.length > 0 && (
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-subtle pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "thin" }}
        >
          {listings.map((l, i) => (
            <a
              key={i}
              href={l.url || "#"}
              target={l.url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group flex-shrink-0 snap-start w-[70%] sm:w-[calc((100%-1.5rem)/3)] rounded-2xl border border-border/50 bg-card/50 overflow-hidden hover:border-primary/40 hover:bg-card transition-all flex flex-col"
            >
              <div className="aspect-[16/10] overflow-hidden relative bg-gradient-to-br from-muted/60 via-card to-muted/30">
                {l.imageUrl ? (
                  <img
                    src={l.imageUrl}
                    alt={`${l.year} ${l.make} ${l.model}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = "none";
                      img.parentElement?.querySelector("[data-fallback]")?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  data-fallback
                  className={`absolute inset-0 grid place-items-center text-muted-foreground/30 ${l.imageUrl ? "hidden" : ""}`}
                >
                  <Car className="h-14 w-14" strokeWidth={1.25} />
                </div>
                {l.url && l.source && (
                  <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-border/60 text-muted-foreground">
                    {l.source}
                  </span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <div className="text-xs font-medium leading-snug line-clamp-2">
                  {l.year} {l.make} {l.model}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {l.mileage.toLocaleString()} miles
                </div>
                <div className="text-base font-semibold tabular-nums text-gradient-primary mt-1">
                  £{l.price.toLocaleString()}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        Comparable listings based on current UK market data.
      </p>
    </section>
  );
}
