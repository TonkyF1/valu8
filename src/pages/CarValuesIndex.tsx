import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { CAR_VALUES_H1, VALUE_HUB_H2, VALUE_HUB_INTRO } from "@/data/carValueContent";
import { VALUE_MODELS, valueModelName, valueModelPath, valueModelsByMake } from "@/data/valueModels";

export default function CarValuesIndex() {
  useSeo(getRouteMeta("/car-values"));
  const makes = [...new Set(CAR_MODELS.map((m) => m.make))].sort();
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">{CAR_VALUES_H1}</h1>
        <p className="text-muted-foreground mb-6">Free, honest valuations for the UK's most popular used cars. Pick your model to see how we value it, or <Link className="text-primary hover:underline" to="/valuation/new">value your car now</Link>.</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {makes.map((make) => (
            <section key={make} aria-labelledby={`mk-${make}`}>
              <h2 id={`mk-${make}`} className="font-semibold mb-1">{make}</h2>
              <ul>
                {CAR_MODELS.filter((m) => m.make === make).map((m) => (
                  <li key={m.slug}><Link className="inline-flex min-h-[44px] items-center text-primary hover:underline" to={`/car-values/${m.makeSlug}/${m.slug}`}>{m.make} {m.model} value</Link></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <section className="mt-12" aria-labelledby="value-hub">
          <h2 id="value-hub" className="text-2xl font-semibold tracking-tight mb-2">{VALUE_HUB_H2}</h2>
          <p className="text-muted-foreground mb-6">{VALUE_HUB_INTRO(VALUE_MODELS.length)}</p>
          <div className="grid gap-6 sm:grid-cols-2">
            {valueModelsByMake().map((g) => (
              <section key={g.make} aria-labelledby={`vm-${g.make}`}>
                <h3 id={`vm-${g.make}`} className="font-semibold mb-1">{g.make}</h3>
                <ul>
                  {g.models.map((v) => (
                    <li key={v.slug}><Link className="inline-flex min-h-[44px] items-center text-primary hover:underline" to={valueModelPath(v)}>{valueModelName(v)} asking prices</Link></li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-6"><Link className="text-primary hover:underline" to="/value">All models</Link></p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
