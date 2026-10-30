import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, BadgePoundSterling, Camera, FileCheck2, Gauge, ShieldAlert, Wind } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { CAR_MODELS } from "@/data/carModels";
import { useSeo } from "@/lib/seo";
import { isPlausibleUkReg, normaliseReg } from "@/lib/registration";
import { getRouteMeta } from "@/data/routeMeta";

const FAQS = [
  { q: "How is the valuation worked out?", a: "Prices are estimated from comparable UK adverts for your make and model, adjusted for your car's age and mileage. Every report shows its confidence level and how the figure was built." },
  { q: "Where does the data come from?", a: "MOT history comes from the official DVSA database. Market prices are estimates built from comparable UK adverts plus an AI market estimate, and are clearly labelled as estimates. Photo condition checks are done by AI. Tax and ULEZ figures are estimates with links to the official checkers." },
  { q: "Is it really free?", a: "Yes. All features are free during early access and no card is needed." },
  { q: "Do I need photos?", a: "No, but adding a few lets us spot condition issues and selling points that move the price, and gives you better advert copy." },
  { q: "Who can see my valuation?", a: "Your valuations are private to your account unless you choose to share a report link. See our privacy policy for how data is handled." },
  { q: "Should I sell privately or part-exchange?", a: "Your report shows both. Private sale usually gets more money; part-exchange is quicker. We show the gap so you can decide if it's worth it." },
];

const FEATURES = [
  { icon: BadgePoundSterling, title: "Market-based pricing", body: "Private-sale, trade-in and dealer estimates based on comparable UK adverts for your make, model, year and mileage." },
  { icon: Camera, title: "Photo condition check", body: "Upload a few photos and AI flags visible wear, damage and selling points that move the price." },
  { icon: FileCheck2, title: "Official DVSA MOT history", body: "Every test, advisory and failure, plus indicative repair-cost bands for current advisories." },
  { icon: Gauge, title: "Mileage consistency", body: "MOT mileage charted over time, with any drops flagged for a closer look." },
  { icon: ShieldAlert, title: "Safety recalls", body: "A direct link to the official GOV.UK recall check for your exact car." },
  { icon: Wind, title: "Tax & ULEZ estimates", body: "Estimated annual VED and ULEZ/Clean Air Zone compliance, with links to the official checkers." },
];

export default function Landing() {
  const { user, loading } = useAuth();
  // Sticky mobile CTA only once the hero CTA has scrolled away, so the first screen has one clear action.
  const heroCta = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const [plate, setPlate] = useState("");
  const [plateErr, setPlateErr] = useState<string | null>(null);
  function onPlateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const reg = normaliseReg(plate);
    if (!isPlausibleUkReg(reg)) { setPlateErr("Enter a valid UK number plate, e.g. AB12 CDE."); return; }
    navigate(`/valuation/new?reg=${encodeURIComponent(reg)}`);
  }
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = heroCta.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShowSticky(true); return; }
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el); return () => io.disconnect();
  }, []);
  useSeo(getRouteMeta("/"));

  // Returning from sign-in with an unfinished valuation: carry on where they left off.
  let pending = false;
  try { pending = !!sessionStorage.getItem("valu8_pending_intent"); } catch { /* ignore */ }
  if (!loading && user && pending) return <Navigate to="/valuation/new" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-32 h-[28rem] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_60%)]" aria-hidden />
          <div className="container relative max-w-6xl pt-12 pb-10 sm:pt-16 lg:pt-24 lg:pb-20 grid grid-cols-1 gap-9 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Free UK car valuation</p>
              <h1 className="mt-3.5 text-[2.25rem] sm:text-[2.75rem] lg:text-[4rem] font-semibold tracking-tight text-gradient leading-[1.05] text-balance">
                What's your car worth today?
              </h1>
              <p className="hidden lg:block mt-5 text-lg text-muted-foreground max-w-md leading-relaxed">
                Enter your number plate for a free private-sale, part-exchange and dealer estimate.
              </p>
            </div>
            <div className="w-full min-w-0 max-w-md mx-auto lg:max-w-none">
              <form
                ref={heroCta}
                onSubmit={onPlateSubmit}
                className="rounded-[20px] border border-primary/20 bg-card/60 p-[18px] sm:p-6 shadow-[0_30px_60px_-30px_hsl(var(--primary)/0.35)] backdrop-blur"
              >
                <label htmlFor="home-reg" className="block text-left text-xs text-muted-foreground mb-2 ml-0.5">Your number plate</label>
                <div className="flex h-16 rounded-xl overflow-hidden bg-[#FDE047] border-2 border-yellow-400/70 shadow-[0_8px_32px_-12px_rgba(255,204,0,0.4)] focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background">
                  <div className="w-[34px] shrink-0 bg-[#003399] text-[#FDE047] flex flex-col items-center justify-between py-2 text-[11px] font-bold" aria-hidden>
                    <span className="text-[13px] leading-none">★</span><span>UK</span>
                  </div>
                  <input
                    id="home-reg"
                    value={plate}
                    onChange={(e) => { setPlate(e.target.value.toUpperCase()); setPlateErr(null); }}
                    placeholder="AB12 CDE"
                    autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10}
                    enterKeyHint="go"
                    aria-invalid={!!plateErr}
                    size={1} className="flex-1 w-full min-w-0 bg-transparent text-center text-[26px] sm:text-[28px] font-bold font-mono tracking-[0.16em] text-black placeholder:text-black/35 caret-black outline-none uppercase"
                  />
                </div>
                {plateErr && <p className="mt-2 text-left text-xs text-destructive" role="alert">{plateErr}</p>}
                <Button type="submit" variant="hero" size="xl" className="mt-3 w-full min-h-[56px] text-[17px]">
                  Value my car <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </form>
              <p className="mt-[18px] text-[13px] text-muted-foreground flex justify-center gap-2">
                Free<span className="text-border" aria-hidden>•</span>No sign-up<span className="text-border" aria-hidden>•</span>Official DVSA MOT data
              </p>
            </div>
          </div>
          <p className="container text-center text-[13px] text-muted-foreground pb-12 pt-[12vh] lg:pt-4 lg:pb-16">
            Buying instead? <Link to="/check" className="text-primary hover:underline underline-offset-2">Check if an advert is fair →</Link>
          </p>
        </section>

        <section className="container max-w-3xl pb-16" aria-labelledby="sample-h">
          <h2 id="sample-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-2">What a report looks like</h2>
          <p className="text-xs text-muted-foreground text-center mb-5">Illustrative example only, not a real vehicle or valuation.</p>
          <div className="rounded-2xl border border-primary/25 bg-card/60 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="font-semibold">2018 Ford Fiesta 1.0 EcoBoost · 42,000 mi</p>
              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Medium confidence</span>
            </div>
            <dl className="grid grid-cols-3 gap-2 mt-5 text-center">
              {[["Part-exchange", "£6,400"], ["Private sale", "£7,700"], ["Dealer retail", "£9,100"]].map(([k, val], i) => (
                <div key={k} className={i === 1 ? "rounded-xl bg-primary/10 border border-primary/30 p-3" : "rounded-xl border border-border p-3"}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums mt-1">{val}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
              <li>• Priced from comparable UK adverts in our database, each corrected to this car's age and mileage</li>
              <li>• MOT: 6 passes, 2 minor advisories, mileage consistent</li>
              <li>• Photos: light scuff on rear bumper (−1%)</li>
              <li>• Suggested asking price, negotiation buffer and a ready-to-post advert</li>
            </ul>
            <div className="mt-5 text-center">
              <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Get my report <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </div>
          </div>
        </section>

        <section className="container max-w-4xl pb-16" aria-labelledby="how-h">
          <h2 id="how-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-8">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-4 text-sm">
            {[["Reg", "Enter your registration and mileage"], ["Details", "Confirm the car and add service notes"], ["Photos", "Add a few photos (optional) for a condition score"], ["Report", "Get your valuation, report and a ready-to-post advert"]].map(([t, d], i) => (
              <li key={t} className="flex sm:flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-muted-foreground mt-0.5 leading-relaxed">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="text-center mt-8">
            <Button asChild variant="hero" size="lg"><Link to="/valuation/new">Start free valuation <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
          </div>
        </section>

        <section className="container max-w-5xl pb-16" aria-labelledby="features-h">
          <h2 id="features-h" className="text-xl md:text-2xl font-semibold tracking-tight text-center mb-2">What's in every report</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Market data where available, official records always.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4 sm:block rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 sm:mb-3"><f.icon className="h-[18px] w-[18px] text-primary" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold text-[15px] mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* TODO(social-proof): add a "What sellers say" section here once we have REAL, consented
            customer quotes or a review-platform widget (e.g. Trustpilot). Never add invented testimonials. */}

        <section className="container max-w-3xl pb-12" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-xl font-semibold text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-xl border border-border bg-card/40 p-4">
                <summary className="font-medium cursor-pointer min-h-[28px]">{f.q}</summary>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container max-w-3xl pb-12" aria-labelledby="models-h">
          <h2 id="models-h" className="text-base font-semibold text-center mb-4">Popular valuations</h2>
          <ul className="flex flex-wrap justify-center gap-2 text-sm">
            {CAR_MODELS.slice(0, 16).map((m) => (
              <li key={m.makeSlug + m.slug}>
                <Link to={`/car-values/${m.makeSlug}/${m.slug}`} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">{m.make} {m.model}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="container max-w-3xl pb-28 sm:pb-8">
          <AccuracyDisclaimer />
        </section>
      </main>
      <Footer />
      {/* Sticky mobile CTA */}
      <div aria-hidden={!showSticky} className={`sm:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ${showSticky ? "translate-y-0" : "translate-y-full pointer-events-none"} border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
        <Button asChild variant="hero" size="lg" className="w-full min-h-[48px]">
          <Link to="/valuation/new" tabIndex={showSticky ? 0 : -1}>Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </Button>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
