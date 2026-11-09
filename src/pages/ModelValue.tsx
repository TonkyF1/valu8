import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { MODEL_PRICES, findModelPrices, findYearPrices } from "@/data/modelPriceBands";
import { VALUE_INDEX_H1, VALUE_INDEX_INTRO, VALUE_TABLE_NOTE, VALUE_YEARS_INTRO, YEAR_NOTE, gbp, miles, neighbourYears, valueIntro, valueName, valuePath, yearIntro, yearPath } from "@/data/valuePages";
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
      {m.years.length > 0 && (
        <section className="mt-8" aria-labelledby="years">
          <h2 id="years" className="text-xl font-semibold mb-1">{name} prices by year</h2>
          <p className="text-sm text-muted-foreground mb-3">{VALUE_YEARS_INTRO(m)}</p>
          <ul className="flex flex-wrap gap-2">
            {m.years.map((y) => (
              <li key={y.year}>
                <Link to={yearPath(m, y)} className="inline-flex min-h-[44px] items-center rounded-xl border border-border px-4 tabular-nums hover:border-primary/50">{y.year}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {m.model}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4"><Link to="/valuation/new">Value my {m.model} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
      <p className="mt-10 text-sm"><Link to="/value" className="text-primary hover:underline">See all models</Link></p>
    </Shell>
  );
}

export function ModelYearValue() {
  const { slug, year } = useParams();
  const m = findModelPrices(slug);
  const y = findYearPrices(m, year);
  useSeo(getRouteMeta(m && y ? yearPath(m, y) : "/value"));
  if (!m || !y) return <NotFound />;
  const name = valueName(m);
  const stats: [string, string][] = [
    ["Median asking price", gbp(y.median)],
    ["Typical range", `${gbp(y.low)} – ${gbp(y.high)}`],
    ["UK adverts", String(y.count)],
    ...(y.mileage ? [["Typical mileage", miles(y.mileage)] as [string, string]] : []),
  ];
  return (
    <Shell>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
        <Link to="/value" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
        <Link to={valuePath(m)} className="hover:text-foreground">{name}</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{y.year}</span>
      </nav>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">What's my {y.year} {name} worth?</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{yearIntro(m, y)}</p>
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border p-4">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={`mt-1 font-semibold tabular-nums ${k === "Median asking price" ? "text-primary text-lg" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {y.byMileage.length > 0 && (
        <section className="mt-8" aria-labelledby="mileage">
          <h2 id="mileage" className="text-xl font-semibold mb-3">{y.year} {name} asking prices by mileage</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Mileage</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Adverts</th></tr>
              </thead>
              <tbody>
                {y.byMileage.map((r) => (
                  <tr key={r.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{r.label}</td>
                    <td className="px-4 py-3 font-semibold text-primary tabular-nums">{gbp(r.median)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{YEAR_NOTE(m, y)}</p>
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {y.year} {m.model}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4"><Link to="/valuation/new">Value my {y.year} {m.model} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {neighbourYears(m, y).map((n) => (
          <Link key={n.year} to={yearPath(m, n)} className="text-primary hover:underline">{n.year} {name} prices</Link>
        ))}
        <Link to={valuePath(m)} className="text-primary hover:underline">All {name} years</Link>
        <Link to="/value" className="text-primary hover:underline">See all models</Link>
      </div>
    </Shell>
  );
}
