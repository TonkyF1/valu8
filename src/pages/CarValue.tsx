import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { SEGMENT_LABEL, SEGMENT_TIPS, findModel } from "@/data/carModels";
import { carFaqs, carIntro, carModelJsonLd, carRelated, carSteps } from "@/data/carValueContent";
import { useSeo } from "@/lib/seo";
import { carModelMeta, getRouteMeta } from "@/data/routeMeta";
import NotFound from "./NotFound";

export default function CarValue() {
  const { make, model } = useParams();
  const car = findModel(make, model);
  const name = car ? `${car.make} ${car.model}` : "";
  useSeo(car ? carModelMeta(car) : getRouteMeta("/car-values"));
  // One head JSON-LD block (the build emits it for crawlers; keep it in sync on client navigation).
  useEffect(() => {
    if (!car) return;
    let el = document.getElementById("car-value-jsonld") as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "car-value-jsonld";
      document.head.appendChild(el);
    }
    el.textContent = carModelJsonLd(car);
    return () => { document.getElementById("car-value-jsonld")?.remove(); };
  }, [car]);
  if (!car) return <NotFound />;

  const seg = SEGMENT_LABEL[car.segment];
  const faqs = carFaqs(car);

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link> <span aria-hidden>/</span>{" "}
          <Link to="/car-values" className="hover:text-foreground">Car values</Link> <span aria-hidden>/</span>{" "}
          <span aria-current="page">{name}</span>
        </nav>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">What's my {name} worth?</h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">{carIntro(car)}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button asChild variant="hero" size="xl"><Link to="/valuation/new">Value my {car.model} <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          <Button asChild variant="outline" size="xl"><Link to="/check">Check a {car.model} asking price</Link></Button>
        </div>

        <section className="mt-12" aria-labelledby="how">
          <h2 id="how" className="text-xl font-semibold mb-3">How we value a {name}</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            {carSteps(car).map((t) => <li key={t}>{t}</li>)}
          </ol>
        </section>

        <section className="mt-10" aria-labelledby="tips">
          <h2 id="tips" className="text-xl font-semibold mb-3">What moves the value of a {seg}</h2>
          <ul className="space-y-2 text-sm">
            {SEGMENT_TIPS[car.segment].map((t) => (
              <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />{t}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-semibold mb-3">{name} valuation FAQ</h2>
          <div className="space-y-2">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-xl border border-border p-4 group">
                <summary className="font-medium cursor-pointer min-h-[28px]">{f.q}</summary>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="related">
          <h2 id="related" className="text-xl font-semibold mb-3">Related valuations</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {carRelated(car).map((m) => (
              <li key={m.makeSlug + m.slug}>
                <Link to={`/car-values/${m.makeSlug}/${m.slug}`} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">
                  {m.make} {m.model}
                </Link>
              </li>
            ))}
            <li><Link to="/car-values" className="inline-flex min-h-[44px] items-center px-4 text-primary">All models</Link></li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
