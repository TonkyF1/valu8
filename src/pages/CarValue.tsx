import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CAR_MODELS, SEGMENT_LABEL, SEGMENT_TIPS, findModel } from "@/data/carModels";
import { useSeo } from "@/lib/seo";
import NotFound from "./NotFound";

export default function CarValue() {
  const { make, model } = useParams();
  const car = findModel(make, model);
  const name = car ? `${car.make} ${car.model}` : "";
  useSeo({
    title: car ? `What's my ${name} worth? Free ${name} valuation | Valu8` : "Car values | Valu8",
    description: car
      ? `Free ${name} valuation using live UK listings, your MOT history and photos. See private sale, part-exchange and dealer values for your ${name}.`
      : "Free UK car valuations.",
    path: car ? `/car-values/${car.makeSlug}/${car.slug}` : "/car-values",
  });
  if (!car) return <NotFound />;

  const seg = SEGMENT_LABEL[car.segment];
  const sameSegment = CAR_MODELS.filter((m) => m.segment === car.segment && m !== car).slice(0, 6);
  const sameMake = CAR_MODELS.filter((m) => m.make === car.make && m !== car);
  const faqs = [
    { q: `How much is my ${name} worth?`, a: `It depends mostly on age, mileage, condition and spec. Valu8 compares your ${name} with similar cars currently for sale in the UK, corrects each one to your car's age and mileage, then adjusts for your MOT history and photos.` },
    { q: `Is a private sale better than part-exchange for a ${name}?`, a: "Usually you'll get more selling privately, because a dealer needs margin to resell. Your report shows both figures so you can decide whether the difference is worth the effort." },
    { q: "Does high mileage hurt the value?", a: `Yes. As a rule of thumb in our model, a car with double the mileage of an otherwise similar ${seg} is worth around 12% less, and very high mileage (over 140,000) carries an extra discount.` },
    { q: "Is Valu8 free?", a: "Yes, during early access. Enter your registration and mileage to get a full report." },
  ];

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
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Get a free, honest valuation for your {name} in a couple of minutes. We check the official DVSA MOT record,
          compare your car with live UK listings for the same model, and read your photos for condition, then give you
          private sale, part-exchange and dealer retail figures.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button asChild variant="hero" size="xl"><Link to="/valuation/new">Value my {car.model} <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          <Button asChild variant="outline" size="xl"><Link to="/buyer">Check a {car.model} asking price</Link></Button>
        </div>

        <section className="mt-12" aria-labelledby="how">
          <h2 id="how" className="text-xl font-semibold mb-3">How we value a {name}</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>Find {name}s for sale now across UK dealers, close to your year and mileage.</li>
            <li>Correct each listing to your car's exact age and mileage, then take the median.</li>
            <li>Adjust for your MOT history (advisories, failures, mileage consistency) and photos.</li>
            <li>Convert dealer prices into what you'd realistically get selling privately or part-exchanging.</li>
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
            {[...sameMake, ...sameSegment.filter((m) => !sameMake.includes(m))].map((m) => (
              <li key={m.makeSlug + m.slug}>
                <Link to={`/car-values/${m.makeSlug}/${m.slug}`} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">
                  {m.make} {m.model}
                </Link>
              </li>
            ))}
            <li><Link to="/car-values" className="inline-flex min-h-[44px] items-center px-4 text-primary">All models</Link></li>
          </ul>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }) }} />
      </main>
      <Footer />
    </div>
  );
}
