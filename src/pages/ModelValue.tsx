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
import { VALUE_BREADCRUMB_JSONLD_ID, VALUE_FAQ_JSONLD_ID, VALUE_NO_DATA_COPY, findRegistryOnly, valueAnswer, valueH1, valueBreadcrumbJsonLd, valueDepreciation, valueFaqJsonLd, valueGuidance, type ValueRef } from "@/data/valuePages";
import { HUB_BREADCRUMB_JSONLD_ID, PRICE_TYPES_COPY, PRICE_TYPES_H2, priceTypesLinks, VALUE_DEPRECIATION_H2, VALUE_MILEAGE_H2, VALUE_MILEAGE_INTRO, VALUE_PAGES_MODIFIED_ISO, VALUE_UPDATED_TEXT, VALUE_WEBPAGE_JSONLD_ID, hubBreadcrumbJsonLd, valueDepreciationText, valueMileageYear, valueWebPageJsonLd } from "@/data/valuePages";
import { VALUE_INDEX_H1, VALUE_INDEX_INTRO, sameMakeModels, VALUE_TABLE_NOTE, VALUE_YEARS_INTRO, YEAR_NOTE, gbp, miles, neighbourYears, valueIntro, valueName, valuePath, yearIntro, yearPath } from "@/data/valuePages";
import { Card, Disclosure, HBars, StatTile, YearChart } from "@/components/value/ValueVisuals";
import { VALUE_GRID_CLASS, VALUE_RAIL_CLASS, valueHeadlineBand } from "@/data/valuePages";
import NotFound from "./NotFound";
import { useEffect, type MouseEvent } from "react";
import { enrichedYearFaqJsonLd, enrichedYearHtml, findEnrichedYear } from "@/data/enrichedYears";
import { enrichedModelHtml, findEnrichedModel } from "@/data/enrichedModels";

const ARTICLE_CLASS = "mt-8 text-foreground/85 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:my-4 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_.guide-table]:my-6 [&_.guide-table]:overflow-x-auto [&_.guide-table]:rounded-xl [&_.guide-table]:border [&_.guide-table]:border-border [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_tr]:border-b [&_tr]:border-border [&_tbody_tr:last-child]:border-0";

/** Client-side navigation for internal links inside prerendered article HTML. */
function useArticleClick() {
  const navigate = useNavigate();
  return (e: MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    e.preventDefault(); navigate(href);
  };
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className={`flex-1 container ${wide ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl"} py-8 md:py-14 pb-28 md:pb-14`}>{children}</main>
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
      <Card className="mt-6">
        <Disclosure summary={<h2 id="how" className="text-xl font-semibold">How we value a {g.name}</h2>}>
          <ol className="space-y-3 text-sm text-muted-foreground [counter-reset:step]">
            {g.steps.map((t) => (
              <li key={t} className="flex gap-3 [counter-increment:step] before:content-[counter(step)] before:mt-0.5 before:flex before:h-6 before:w-6 before:shrink-0 before:items-center before:justify-center before:rounded-full before:border before:border-primary/40 before:text-xs before:font-semibold before:text-primary">{t}</li>
            ))}
          </ol>
        </Disclosure>
      </Card>
      {g.segment && (
        <Card className="mt-6">
          <section aria-labelledby="tips">
            <h2 id="tips" className="text-xl font-semibold mb-4">What moves the value of a {g.segment.label}</h2>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {g.segment.tips.map((t) => (
                <li key={t} className="flex gap-2 rounded-xl border border-border bg-background/60 p-3"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />{t}</li>
              ))}
            </ul>
          </section>
        </Card>
      )}
      <Card className="mt-6">
        <section aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-semibold mb-2">{g.name} valuation FAQ</h2>
          <div className="divide-y divide-border">
            {g.faqs.map((f) => (
              <Disclosure key={f.q} summary={<h3 className="font-medium py-1">{f.q}</h3>}>
                <p className="text-sm text-muted-foreground leading-relaxed pb-3">{f.a}</p>
              </Disclosure>
            ))}
          </div>
        </section>
      </Card>
      {g.related.length > 0 && (
        <section className="mt-8" aria-labelledby="related">
          <h2 id="related" className="text-xl font-semibold mb-3">Related valuations</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {g.related.map((v) => (
              <li key={v.slug}>
                <Link to={valueModelPath(v)} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card/60 px-4 hover:border-primary/60 hover:text-primary transition-colors">{modelDisplayName(v)}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Laptop layout: content column plus a sticky summary rail (the rail only exists from 1024px). Same classes as the prerender. */
const VALUE_GRID = VALUE_GRID_CLASS;

/**
 * Laptop-only sticky rail: the headline figures and the CTA stay in view while the reader scrolls the charts and
 * tables. Purely a repeat of figures already on the page (data-decor, excluded from the copy check); on phones and
 * tablets the same figures and CTA sit in the hero instead.
 */
function SummaryRail({ name, median, range, adverts, band, jump }: { name: string; median: string; range: string; adverts: string; band: string; jump: [string, string][] }) {
  return (
    <aside className={VALUE_RAIL_CLASS} data-decor="" aria-label={`${name} price summary`}>
      <div className="rounded-3xl border border-border bg-card/70 p-6 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{name} · {band}</p>
        <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-primary">{median}</p>
        <p className="mt-1 text-sm text-muted-foreground">Median asking price</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 text-sm">
          <div><dt className="text-muted-foreground">Typical range</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{range}</dd></div>
          <div><dt className="text-muted-foreground">Adverts</dt><dd className="mt-1 font-semibold tabular-nums text-foreground">{adverts}</dd></div>
        </dl>
        <Button asChild variant="hero" size="lg" className="mt-6 w-full whitespace-normal text-center h-auto min-h-12 py-3"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Your reg, mileage and official DVSA MOT history give a figure for your own car.</p>
      </div>
      {jump.length > 1 && (
        <nav aria-label="On this page" className="mt-4 rounded-2xl border border-border p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">On this page</p>
          <ul className="space-y-0.5 text-sm">
            {jump.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="flex min-h-[36px] items-center rounded-lg px-2 text-foreground/80 hover:bg-muted/50 hover:text-foreground">{label}</a></li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
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
      <div className="mt-6"><Button asChild variant="hero" size="xl" className="max-w-full whitespace-normal text-center h-auto min-h-14 py-3"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button></div>
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
      <ul className="flex flex-wrap gap-2 text-sm">
        {others.map((v) => (
          <li key={v.slug}><Link to={valueModelPath(v)} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card/60 px-4 hover:border-primary/60 hover:text-primary transition-colors">{modelDisplayName(v)}</Link></li>
        ))}
      </ul>
    </section>
  );
}

export function ValueIndex() {
  useSeo(getValueRouteMeta("/value"));
  useHeadJsonLd(HUB_BREADCRUMB_JSONLD_ID, hubBreadcrumbJsonLd("Car values", "/value"));
  return (
    <Shell wide>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{VALUE_INDEX_H1}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed max-w-3xl">{VALUE_INDEX_INTRO}</p>
      {valueModelsByMake().map((g) => (
        <section key={g.make} className="mt-8" aria-labelledby={`make-${g.make}`}>
          <h2 id={`make-${g.make}`} className="text-lg font-semibold mb-2">{g.make}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
  const onArticleClick = useArticleClick();
  if (!ref) return <NotFound />;
  if (!m) return <NoPriceModel m={ref} />;
  const name = valueName(m);
  const depreciation = valueDepreciationText(m);
  const mileageYear = valueMileageYear(m);
  const enrichedModel = findEnrichedModel(m.slug);
  const depn = valueDepreciation(m);
  const headline = valueHeadlineBand(m);
  const jump: [string, string][] = [
    ["prices", "Prices by year group"],
    ...(m.years.length > 0 ? [["years", "Prices by year"] as [string, string]] : []),
    ...(depreciation ? [["depreciation", "Depreciation"] as [string, string]] : []),
    ...(mileageYear ? [["mileage-model", "Mileage"] as [string, string]] : []),
    ["faq", "FAQ"],
  ];
  return (
    <Shell wide>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
        <Link to="/value" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{name}</span>
      </nav>
      <div className={VALUE_GRID}>
      <div className="min-w-0">
      <div className="rounded-3xl border border-border bg-gradient-to-b from-card to-background p-5 md:p-9">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{valueH1(m)}</h1>
        <p className="mt-5 text-lg md:text-xl leading-relaxed text-foreground">{valueAnswer(m)}</p>
        {headline && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:hidden" data-decor="">
            <StatTile accent label="Median asking price" value={gbp(headline.median)} />
            <StatTile label="Adverts" value={m.listings.toLocaleString("en-GB")} />
            <StatTile wide label="Typical range" value={`${gbp(headline.low)} – ${gbp(headline.high)}`} />
          </div>
        )}
        <div className={`cta mt-6 rounded-2xl border border-primary/30 bg-background/70 p-5${headline ? " lg:hidden" : ""}`}>
          <h2 className="text-lg font-semibold">Get a figure for your {name}</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
          <Button asChild variant="hero" size="xl" className="mt-4 w-full max-w-full whitespace-normal text-center h-auto min-h-14 py-3"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </div>
        <p className="text-muted-foreground mt-6 text-sm leading-relaxed">{valueIntro(m)}</p>
      </div>
      <Card className="mt-6">
        <section aria-labelledby="prices">
          <h2 id="prices" className="text-xl font-semibold mb-5">Typical {name} asking prices by year group</h2>
          <HBars ariaLabel="Median asking price by year group" rows={m.bands.map((b) => ({ label: b.band, value: b.median }))} />
          <Disclosure chrome className="mt-5 border-t border-border pt-2" summary={<span className="text-sm font-medium text-primary">View table</span>}>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border"><th className="px-4 py-3 font-medium">Years</th><th className="px-4 py-3 font-medium">Median asking price</th><th className="px-4 py-3 font-medium">Typical range</th></tr>
                </thead>
                <tbody>
                  {m.bands.map((b) => (
                    <tr key={b.band} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{b.band}</td>
                      <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{gbp(b.median)}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{gbp(b.low)} – {gbp(b.high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">{VALUE_TABLE_NOTE(m)}</p>
          <p className="text-xs text-muted-foreground mt-1"><time dateTime={VALUE_PAGES_MODIFIED_ISO}>{VALUE_UPDATED_TEXT}</time></p>
        </section>
      </Card>
      {m.years.length > 0 && (
        <Card className="mt-6">
          <section aria-labelledby="years">
            <h2 id="years" className="text-xl font-semibold mb-1">{name} value by year</h2>
            <p className="text-sm text-muted-foreground mb-5">{VALUE_YEARS_INTRO(m)}</p>
            {m.years.length > 1 && <YearChart years={m.years} ariaLabel="Median asking price by year, with typical range" />}
            <Disclosure chrome className="mt-5 border-t border-border pt-2" summary={<span className="text-sm font-medium text-primary">View table</span>}>
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
                        <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{gbp(y.median)}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{gbp(y.low)} – {gbp(y.high)}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">{y.mileage ? miles(y.mileage) : "–"}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{y.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          </section>
        </Card>
      )}
      {(depreciation || mileageYear) && (
        <div className={`mt-6 grid gap-6 ${depreciation && mileageYear ? "md:grid-cols-2" : ""}`}>
          {depreciation && (
            <Card>
              <section aria-labelledby="depreciation">
                <h2 id="depreciation" className="text-xl font-semibold mb-3">{VALUE_DEPRECIATION_H2(m)}</h2>
                {depn && (
                  <div className="mb-4 flex items-baseline gap-3" data-decor="" aria-hidden>
                    <span className="text-5xl font-semibold tabular-nums text-primary">−{depn.pct}%</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{depn.from} → {depn.to}</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">{depreciation}</p>
              </section>
            </Card>
          )}
          {mileageYear && (
            <Card>
              <section aria-labelledby="mileage-model">
                <h2 id="mileage-model" className="text-xl font-semibold mb-2">{VALUE_MILEAGE_H2(m)}</h2>
                <p className="text-sm text-muted-foreground mb-4">{VALUE_MILEAGE_INTRO(m, mileageYear)}</p>
                <HBars ariaLabel="Median asking price by mileage" rows={mileageYear.byMileage.map((r) => ({ label: r.label, value: r.median }))} />
                <Disclosure chrome className="mt-5 border-t border-border pt-2" summary={<span className="text-sm font-medium text-primary">View table</span>}>
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
                            <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{gbp(r.median)}</td>
                            <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Disclosure>
              </section>
            </Card>
          )}
        </div>
      )}
      {enrichedModel && (
        <Card className="mt-6">
          <Disclosure chrome summary={<span className="text-lg font-semibold">Read the full {name} guide</span>}>
            <article className={ARTICLE_CLASS.replace("mt-8 ", "")} onClick={onArticleClick} dangerouslySetInnerHTML={{ __html: enrichedModelHtml(enrichedModel, m) }} />
          </Disclosure>
        </Card>
      )}
      <Card className="mt-6">
        <Disclosure summary={<h2 id="price-types" className="text-xl font-semibold">{PRICE_TYPES_H2(m)}</h2>}>
          {PRICE_TYPES_COPY(m).map((p) => <p key={p} className="text-sm text-muted-foreground leading-relaxed mt-3">{p}</p>)}
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {priceTypesLinks(m).map(([href, label]) => (
              <li key={href}><Link to={href} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 text-primary hover:border-primary/60">{label}</Link></li>
            ))}
          </ul>
        </Disclosure>
      </Card>
      <Guidance m={m} />
      <MoreFromMake slug={m.slug} make={m.make} />
      <p className="mt-10 text-sm"><Link to="/value" className="text-primary hover:underline">See all models</Link></p>
      </div>
      {headline && <SummaryRail name={name} median={gbp(headline.median)} range={`${gbp(headline.low)} – ${gbp(headline.high)}`} adverts={m.listings.toLocaleString("en-GB")} band={headline.band} jump={jump} />}
      </div>
      <div data-decor="" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-3 backdrop-blur md:hidden">
        <Button asChild variant="hero" size="lg" className="w-full"><Link to="/">Value my {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
    </Shell>
  );
}

export function ModelYearValue() {
  const { slug, year } = useParams();
  const m = findModelPrices(slug);
  const y = findYearPrices(m, year);
  useSeo(m && y ? getValueRouteMeta(yearPath(m, y)) : null);
  const enriched = m && y ? findEnrichedYear(m.slug, y.year) : undefined;
  const onArticleClick = useArticleClick();
  useEffect(() => {
    if (!enriched || !m || !y) return;
    let el = document.getElementById("year-faq-jsonld") as HTMLScriptElement | null;
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = "year-faq-jsonld"; document.head.appendChild(el); }
    el.textContent = enrichedYearFaqJsonLd(enriched, m, y);
    return () => { document.getElementById("year-faq-jsonld")?.remove(); };
  }, [enriched, m, y]);
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
                    <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{gbp(r.median)}</td>
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
          className={ARTICLE_CLASS}
          onClick={onArticleClick}
          dangerouslySetInnerHTML={{ __html: enrichedYearHtml(enriched, m, y) }}
        />
      )}
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">Get a figure for your {y.year} {name}</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="xl" className="mt-4 max-w-full whitespace-normal text-center h-auto min-h-14 py-3"><Link to="/">Value my {y.year} {name} free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
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
