import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/lib/seo";
import { getValueRouteMeta } from "@/data/valueRoutes";
import { valueModelPath, valueModelsByMake } from "@/data/valueModels";
import { modelDisplayName } from "@/data/modelDisplayName";
import { findModelPrices, findYearPrices } from "@/data/modelPriceBands";
import { VALUE_BREADCRUMB_JSONLD_ID, VALUE_FAQ_JSONLD_ID, VALUE_NO_DATA_COPY, findRegistryOnly, valueAnswer, valueH1, valueBreadcrumbJsonLd, valueFaqJsonLd, valueGuidance, type ValueRef } from "@/data/valuePages";
import { HUB_BREADCRUMB_JSONLD_ID, PRICE_TYPES_COPY, PRICE_TYPES_H2, PRICE_TYPES_LINKS, VALUE_DEPRECIATION_H2, VALUE_MILEAGE_H2, VALUE_MILEAGE_INTRO, VALUE_PAGES_MODIFIED_ISO, VALUE_UPDATED_TEXT, VALUE_WEBPAGE_JSONLD_ID, hubBreadcrumbJsonLd, valueDepreciationText, valueMileageYear, valueWebPageJsonLd } from "@/data/valuePages";
import { VALUE_INDEX_H1, VALUE_INDEX_INTRO, sameMakeModels, VALUE_TABLE_NOTE, VALUE_YEARS_INTRO, YEAR_NOTE, gbp, miles, neighbourYears, valueIntro, valueName, valuePath, yearIntro, yearPath } from "@/data/valuePages";
import NotFound from "./NotFound";
import { useEffect, type MouseEvent } from "react";
import { enrichedYearFaqJsonLd, enrichedYearHtml, findEnrichedYear } from "@/data/enrichedYears";

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

/** Keep one head JSON-LD block per id: reuse the prerendered one when present, else add it; remove on leave. */
function useHeadJsonLd(id: string, json: string | null) {
  useEffect(() => {
    if (!json) return;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
    el.textContent = json;
    return () => { document.getElementById(id)?.remove(); };
  }, [id, json]);
}

/** Same visible content as guidanceHtml() in valuePages.ts (the build-time HTML). */
function Guidance({ m }: { m: ValueRef }) {
  const g = valueGuidance(m);
  return (
    <>
      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="text-xl font-semibold mb-3">How we value a {g.name}</h2>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          {g.steps.map((t) => <li key={t}>{t}</li>)}
        </ol>
      </section>
      {g.segment && (
        <section className="mt-10" aria-labelledby="tips">
          <h2 id="tips" className="text-xl font-semibold mb-3">What moves the value of a {g.segment.label}</h2>
          <ul className="space-y-2 text-sm">
            {g.segment.tips.map((t) => (
              <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />{t}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="text-xl font-semibold mb-3">{g.name} valuation FAQ</h2>
        <div className="space-y-3">
          {g.faqs.map((f) => (
            <div key={f.q} className="rounded-xl border border-border p-4">
              <h3 className="font-medium">{f.q}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
      {g.related.length > 0 && (
        <section className="mt-10" aria-labelledby="related">
          <h2 id="related" className="text-xl font-semibold mb-3">Related valuations</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {g.related.map((v) => (
              <li key={v.slug}>
                <Link to={valueModelPath(v)} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">{modelDisplayName(v)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Crumbs({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
      <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
      <Link to="/value" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
      <span aria-current="page">{name}</span>
    </nav>
  );
}

/** Same visible content as valueFallbackBodyHtml() in valuePages.ts. */
function NoPriceModel({ m }: { m: ValueRef }) {
  const name = valueName(m);
  return (
    <Shell>
      <Crumbs name={name} />
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{valueH1(m)}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{VALUE_NO_DATA_COPY(m)}</p>
      <div className="mt-6"><Button asChild variant="hero" size="xl"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button></div>
      <Guidance m={m} />
      <MoreFromMake slug={m.slug} make={m.make} />
      <p className="mt-10 text-sm"><Link to="/value" className="text-primary hover:underline">See all models</Link></p>
    </Shell>
  );
}

function MoreFromMake({ slug, make }: { slug: string; make: string }) {
  const others = sameMakeModels(slug, make);
  if (!others.length) return null;
  return (
    <section className="mt-10" aria-labelledby="more-make">
      <h2 id="more-make" className="text-lg font-semibold mb-2">More {make} asking prices</h2>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {others.map((v) => (
          <li key={v.slug}><Link to={valueModelPath(v)} className="inline-flex min-h-[44px] items-center text-primary hover:underline">{modelDisplayName(v)}</Link></li>
        ))}
      </ul>
    </section>
  );
}

export function ValueIndex() {
  useSeo(getValueRouteMeta("/value"));
  useHeadJsonLd(HUB_BREADCRUMB_JSONLD_ID, hubBreadcrumbJsonLd("Car values", "/value"));
  return (
    <Shell>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{VALUE_INDEX_H1}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{VALUE_INDEX_INTRO}</p>
      {valueModelsByMake().map((g) => (
        <section key={g.make} className="mt-8" aria-labelledby={`make-${g.make}`}>
          <h2 id={`make-${g.make}`} className="text-lg font-semibold mb-2">{g.make}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {g.models.map((v) => (
              <li key={v.slug}>
                <Link to={valueModelPath(v)} className="flex min-h-[44px] items-center justify-between rounded-xl border border-border px-4 py-3 hover:border-primary/50">
                  <span>{modelDisplayName(v)}</span><ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-10"><Button asChild variant="hero" size="xl"><Link to="/">Value a car free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button></div>
    </Shell>
  );
}

export default function ModelValue() {
  const { slug } = useParams();
  const m = findModelPrices(slug);
  // A published slug with no current price data still gets its page (registry), just without the table.
  const ref: ValueRef | undefined = m ?? findRegistryOnly(slug);
  useSeo(ref ? getValueRouteMeta(valuePath(ref)) : null);
  useHeadJsonLd(VALUE_BREADCRUMB_JSONLD_ID, ref ? valueBreadcrumbJsonLd(ref) : null);
  useHeadJsonLd(VALUE_FAQ_JSONLD_ID, ref ? valueFaqJsonLd(ref) : null);
  useHeadJsonLd(VALUE_WEBPAGE_JSONLD_ID, ref ? valueWebPageJsonLd(ref) : null);
  if (!ref) return <NotFound />;
  if (!m) return <NoPriceModel m={ref} />;
  const name = valueName(m);
  const depreciation = valueDepreciationText(m);
  const mileageYear = valueMileageYear(m);
  return (
    <Shell>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
        <Link to="/value" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{name}</span>
      </nav>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{valueH1(m)}</h1>
      <p className="mt-4 text-lg leading-relaxed text-foreground">{valueAnswer(m)}</p>
      <p className="text-muted-foreground mt-4 leading-relaxed">{valueIntro(m)}</p>
      <section className="mt-8" aria-labelledby="prices">
        <h2 id="prices" className="text-xl font-semibold mb-3">Typical {name} asking prices by year group</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Years</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Typical range</th></tr>
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
        <p className="text-xs text-muted-foreground mt-1"><time dateTime={VALUE_PAGES_MODIFIED_ISO}>{VALUE_UPDATED_TEXT}</time></p>
      </section>
      {m.years.length > 0 && (
        <section className="mt-8" aria-labelledby="years">
          <h2 id="years" className="text-xl font-semibold mb-1">{name} prices by year</h2>
          <p className="text-sm text-muted-foreground mb-3">{VALUE_YEARS_INTRO(m)}</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">{name} asking prices for every year</caption>
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Year</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Typical range</th><th className="px-4 py-3 font-medium">Typical mileage</th><th className="px-4 py-3 font-medium">Adverts</th></tr>
              </thead>
              <tbody>
                {m.years.map((y) => (
                  <tr key={y.year} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><Link to={yearPath(m, y)} className="inline-flex min-h-[44px] items-center text-primary hover:underline tabular-nums">{y.year}</Link></td>
                    <td className="px-4 py-3 font-semibold text-primary tabular-nums">{gbp(y.median)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{gbp(y.low)} – {gbp(y.high)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{y.mileage ? miles(y.mileage) : "–"}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{y.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {depreciation && (
        <section className="mt-8" aria-labelledby="depreciation">
          <h2 id="depreciation" className="text-xl font-semibold mb-2">{VALUE_DEPRECIATION_H2(m)}</h2>
          <p className="text-muted-foreground leading-relaxed">{depreciation}</p>
        </section>
      )}
      {mileageYear && (
        <section className="mt-8" aria-labelledby="mileage-model">
          <h2 id="mileage-model" className="text-xl font-semibold mb-2">{VALUE_MILEAGE_H2(m)}</h2>
          <p className="text-sm text-muted-foreground mb-3">{VALUE_MILEAGE_INTRO(m, mileageYear)}</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">{mileageYear.year} {name} asking prices by mileage</caption>
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Mileage</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Adverts</th></tr>
              </thead>
              <tbody>
                {mileageYear.byMileage.map((r) => (
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
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {name}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
      <section className="mt-12" aria-labelledby="price-types">
        <h2 id="price-types" className="text-xl font-semibold mb-3">{PRICE_TYPES_H2}</h2>
        {PRICE_TYPES_COPY(m).map((p) => <p key={p} className="text-muted-foreground leading-relaxed mt-3">{p}</p>)}
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {PRICE_TYPES_LINKS.map(([href, label]) => (
            <li key={href}><Link to={href} className="inline-flex min-h-[44px] items-center text-primary hover:underline">{label}</Link></li>
          ))}
        </ul>
      </section>
      <Guidance m={m} />
      <MoreFromMake slug={m.slug} make={m.make} />
      <p className="mt-10 text-sm"><Link to="/value" className="text-primary hover:underline">See all models</Link></p>
    </Shell>
  );
}

export function ModelYearValue() {
  const { slug, year } = useParams();
  const m = findModelPrices(slug);
  const y = findYearPrices(m, year);
  useSeo(m && y ? getValueRouteMeta(yearPath(m, y)) : null);
  const enriched = m && y ? findEnrichedYear(m.slug, y.year) : undefined;
  const navigate = useNavigate();
  useEffect(() => {
    if (!enriched || !m || !y) return;
    let el = document.getElementById("year-faq-jsonld") as HTMLScriptElement | null;
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "year-faq-jsonld"; document.head.appendChild(el); }
    el.textContent = enrichedYearFaqJsonLd(enriched, m, y);
    return () => { document.getElementById("year-faq-jsonld")?.remove(); };
  }, [enriched, m, y]);
  if (!m || !y) return <NotFound />;
  const onArticleClick = (e: MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    e.preventDefault(); navigate(href);
  };
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
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">How much is my {y.year} {name} worth?</h1>
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
      {enriched && (
        <article
          className="mt-8 text-foreground/85 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:my-4 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
          onClick={onArticleClick}
          dangerouslySetInnerHTML={{ __html: enrichedYearHtml(enriched, m, y) }}
        />
      )}
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {y.year} {name}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4"><Link to="/">Value my {y.year} {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
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
