import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { MODEL_PRICES, findModelPrices } from "@/data/modelPriceBands";
import { VALUE_INDEX_H1, VALUE_INDEX_INTRO, VALUE_TABLE_NOTE, gbp, valueIntro, valueName, valuePath } from "@/data/valuePages";
import NotFound from "./NotFound";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">{children}</main>
      <Footer />
    </div>
  );
}

export function ValueIndex() {
  useSeo(getRouteMeta("/value"));
  return (
    <Shell>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{VALUE_INDEX_H1}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{VALUE_INDEX_INTRO}</p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {MODEL_PRICES.map((m) => (
          <li key={m.slug}>
            <Link to={valuePath(m)} className="flex min-h-[44px] items-center justify-between rounded-xl border border-border px-4 py-3 hover:border-primary/50">
              <span>{valueName(m)}</span><ArrowRight className="h-4 w-4 text-primary" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-10"><Button asChild variant="hero" size="xl"><Link to="/valuation/new">Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button></div>
    </Shell>
  );
}

export default function ModelValue() {
  const { slug } = useParams();
  const m = findModelPrices(slug);
  useSeo(getRouteMeta(m ? valuePath(m) : "/value"));
  if (!m) return <NotFound />;
  const name = valueName(m);
  return (
    <Shell>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
        <Link to="/value" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{name}</span>
      </nav>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">What's my {name} worth?</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{valueIntro(m)}</p>
      <section className="mt-8" aria-labelledby="prices">
        <h2 id="prices" className="text-xl font-semibold mb-3">Typical {name} asking prices by year</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Year</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Typical range</th></tr>
            </thead>
            <tbody>
              {m.bands.map((b) => (
                <tr key={b.band} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{b.band}</td>
                  <td className="px-4 py-3 font-semibold text-primary tabular-nums">{gbp(b.median)}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{gbp(b.low)} – {gbp(b.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{VALUE_TABLE_NOTE(m)}</p>
      </section>
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {m.model}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4"><Link to="/valuation/new">Value my {m.model} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
      <p className="mt-10 text-sm"><Link to="/value" className="text-primary hover:underline">See all models</Link></p>
    </Shell>
  );
}
