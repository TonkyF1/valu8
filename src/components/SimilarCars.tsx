import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Car, Loader2 } from "lucide-react";

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

  return (
    <section className="mb-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Similar Cars Currently For Sale
        </h2>
        <span className="text-[11px] text-muted-foreground/70">UK marketplaces</span>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {listings.map((l, i) => (
            <a
              key={i}
              href={l.url || "#"}
              target={l.url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border/50 bg-card/50 overflow-hidden hover:border-primary/40 hover:bg-card transition-all flex flex-col"
            >
              <div className="aspect-[16/10] bg-muted/40 overflow-hidden relative">
                {l.imageUrl ? (
                  <img
                    src={l.imageUrl}
                    alt={l.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground/40">
                    <Car className="h-10 w-10" />
                  </div>
                )}
                <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground">
                  {l.source}
                </span>
              </div>
              <div className="p-3.5 flex-1 flex flex-col gap-1.5">
                <div className="text-sm font-medium leading-snug line-clamp-2">
                  {l.year} {l.make} {l.model}
                  {l.variant ? ` ${l.variant}` : ""}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {l.mileage.toLocaleString()} miles{l.location ? ` · ${l.location}` : ""}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-base font-semibold tabular-nums text-gradient-primary">
                    £{l.price.toLocaleString()}
                  </span>
                  {l.url && (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 group-hover:text-primary transition-colors">
                      View <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60 mt-2">
        Comparable listings generated from current UK market data. Click through to search for live results on each marketplace.
      </p>
    </section>
  );
}
