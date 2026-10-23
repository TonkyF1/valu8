import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";

export default function CarValuesIndex() {
  useSeo({ title: "Car values by make and model | Valu8", description: "Free valuations for the UK's most popular cars, from the Ford Fiesta to the Tesla Model 3.", path: "/car-values" });
  const makes = [...new Set(CAR_MODELS.map((m) => m.make))].sort();
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Car values by make and model</h1>
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
      </main>
      <Footer />
    </div>
  );
}
