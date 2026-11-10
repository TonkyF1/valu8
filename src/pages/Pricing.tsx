import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";

const FREE = [
  "Instant valuation from your reg and mileage",
  "Private sale, part-exchange and dealer figures",
  "DVSA MOT history and mileage check",
  "GOV.UK recall-check link, tax and ULEZ estimates",
  "\"Is this advert fair?\" checks when buying",
];

const PREMIUM = [
  "Priced against comparable UK adverts",
  "AI photo condition score and what it does to the price",
  "Suggested asking price and negotiation buffer",
  "Ready-to-post marketplace advert",
  "Advisory repair-cost bands, compare and shareable report",
];

const FAQ = [
  { q: "Is the valuation free?", a: "Yes. Essentials — the instant valuation from your reg and mileage, MOT history and more — is free." },
  { q: "What does the Full seller report cost?", a: "£2.99 one-off for that car. No subscription. Pay by card, Apple Pay or Google Pay." },
  { q: "How accurate is it?", a: "It's an estimate. We publish how we measure accuracy on the Accuracy page." },
];

export default function Pricing() {
  const [params] = useSearchParams();
  useSeo(getRouteMeta("/pricing"));
  useEffect(() => { if (params.get("billing") === "cancelled") toast("Checkout cancelled"); }, [params]);

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-4xl py-12 md:py-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">A price you can defend, without paying a dealer's margin</h1>
          <p className="mt-3 text-muted-foreground">Essentials is free. Unlock the Full seller report for a one-off £2.99 when you want the extra detail.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border/60 bg-card/50 p-6 flex flex-col">
            <h2 className="text-lg font-semibold">Essentials</h2>
            <p className="mt-1 text-sm text-muted-foreground">The facts about any car, in a minute.</p>
            <p className="mt-4 text-3xl font-bold">Free</p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {FREE.map((i) => (
                <li key={i} className="flex gap-2.5 text-sm"><Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />{i}</li>
              ))}
            </ul>
            <Button asChild variant="outline" size="lg" className="mt-6 w-full"><Link to="/valuation/new">Value my car</Link></Button>
          </section>

          <section className="relative rounded-2xl border border-primary/40 bg-card/70 p-6 flex flex-col shadow-[0_0_60px_-30px_hsl(var(--primary)/0.6)]">
            <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">One-off · £2.99</span>
            <h2 className="text-lg font-semibold">Full seller report</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything in Essentials, plus what helps you sell for more.</p>
            <p className="mt-4 text-3xl font-bold">£2.99 <span className="text-base font-normal text-muted-foreground">one-off</span></p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {PREMIUM.map((i) => (
                <li key={i} className="flex gap-2.5 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />{i}</li>
              ))}
            </ul>
            <Button asChild variant="hero" size="lg" className="mt-6 w-full"><Link to="/valuation/new">Get my full report · £2.99</Link></Button>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Pay by card, Apple Pay or Google Pay. One-off — no subscription.</p>

        <section className="mt-14 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-center">Questions</h2>
          <dl className="mt-6 divide-y divide-border/60 border-y border-border/60">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{f.a}{f.q.startsWith("How") && <> <Link to="/accuracy" className="text-primary hover:underline">See accuracy</Link>.</>}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </div>
  );
}
