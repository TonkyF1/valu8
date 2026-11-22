import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Database, FileCheck2, Gauge, ScanSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAIL } from "@/lib/site";
import { FOUNDER_PHOTO, FOUNDER_PHOTO_ALT, ICO_REGISTERED_ON, ICO_REGISTRATION, LEGAL_NAME } from "@/lib/legal";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";

/** Where each part of a valuation comes from. Facts only: these are the services the app actually calls. */
export const ABOUT_SOURCES: { icon: typeof Database; title: string; text: string }[] = [
  { icon: FileCheck2, title: "Official MOT history", text: "Every MOT test, mileage reading and advisory comes from the DVSA's MOT History API, the government's own record." },
  { icon: Database, title: "Vehicle details", text: "Make, model, year, engine and colour come from a licensed UK vehicle-data provider, using the registration you enter." },
  { icon: Gauge, title: "UK asking prices", text: "Prices come from UK private and dealer car adverts we collect, matched to your make and model, then adjusted for age, mileage and condition." },
  { icon: TriangleAlert, title: "Safety recalls", text: "The recall link uses the DVSA's official Check vehicle recalls service." },
  { icon: ScanSearch, title: "Photo checks (optional)", text: "If you add photos, AI looks at visible condition. You can always value a car without them." },
];

export const ABOUT_STEPS: string[] = [
  "You enter a registration. We look up the car and its official MOT history.",
  "Where there are enough UK adverts for your make and model, we anchor the price to them and adjust for age and mileage.",
  "When there aren't enough adverts, the report says so and shows an AI market estimate, so you can treat it as a guide.",
  "Every report shows its confidence level. Figures are estimates, not financial advice or a guaranteed sale price.",
];

export const ABOUT_PROMISES: string[] = [
  "We don't buy cars, so we have no reason to talk your price down.",
  "We never sell your personal data.",
  "Payments are taken by Stripe. We never see your card details.",
];

export default function About() {
  const { pathname } = useLocation();
  const isContact = pathname.startsWith("/contact");
  useSeo(getRouteMeta(isContact ? "/contact" : "/about"));
  const named = LEGAL_NAME.trim();
  const operator = named || "Valu8 (valu8.uk)";
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-5xl py-12 md:py-20">
        <header className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-4">{isContact ? "Contact" : "About"}</p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground">{isContact ? "Get in touch" : "About Valu8"}</h1>
          <p className="mt-6 text-lg md:text-xl leading-relaxed text-foreground/85">
            {named ? <>Valu8 (valu8.uk) is run by {named}. It is an</> : <>Valu8 (valu8.uk) is an</>} independent car valuation tool for UK private sellers and buyers.
          </p>
        </header>

        <dl className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="Valu8 at a glance">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <dt className="text-sm text-muted-foreground">Run by</dt>
            <dd className="mt-1.5 text-base font-semibold text-foreground">{operator}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <dt className="text-sm text-muted-foreground">Data protection</dt>
            <dd className="mt-1.5 text-base font-semibold text-foreground">ICO registered, <span className="tabular-nums">{ICO_REGISTRATION}</span></dd>
            <dd className="mt-1 text-sm text-muted-foreground">Registered {ICO_REGISTERED_ON}</dd>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <dt className="text-sm text-muted-foreground">Contact</dt>
            <dd className="mt-1.5 text-base font-semibold"><a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd>
          </div>
        </dl>

        {FOUNDER_PHOTO && (
          <figure className="mt-10 flex items-center gap-4">
            <img src={FOUNDER_PHOTO} alt={FOUNDER_PHOTO_ALT} width={72} height={72} loading="lazy" className="h-[72px] w-[72px] rounded-full border border-border object-cover" />
            <figcaption className="text-sm text-muted-foreground">{FOUNDER_PHOTO_ALT}</figcaption>
          </figure>
        )}

        <section id="data" aria-labelledby="data-h" className="mt-16">
          <h2 id="data-h" className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Where the data comes from</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ABOUT_SOURCES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-border bg-card/60 p-5">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <section id="how-it-works" aria-labelledby="how-h">
            <h2 id="how-h" className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">How valuations work</h2>
            <ol className="mt-6 space-y-4">
              {ABOUT_STEPS.map((t, i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold tabular-nums text-foreground" aria-hidden>{i + 1}</span>
                  <p className="text-[15px] leading-relaxed text-foreground/85">{t}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm"><Link to="/how-it-works" className="text-primary hover:underline">More on how Valu8 works</Link></p>
          </section>

          <section aria-labelledby="promise-h">
            <h2 id="promise-h" className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">What you can count on</h2>
            <ul className="mt-6 space-y-3">
              {ABOUT_PROMISES.map((t) => (
                <li key={t} className="flex gap-3 rounded-2xl border border-border bg-card/60 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className="text-[15px] leading-relaxed text-foreground/85">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="ea-h" className="mt-16 rounded-3xl border border-border bg-card/60 p-6 md:p-8">
          <h2 id="ea-h" className="text-xl font-semibold text-foreground">Still improving</h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
            Valu8 is new and still improving. Valuations are free; the Premium Report is a one-off £2.99. Some valuations will be less precise than others while we grow our data, and we would rather tell you that than pretend otherwise.
          </p>
        </section>

        <section id="contact" aria-labelledby="contact-h" className="mt-16 flex flex-col gap-6 border-t border-border pt-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 id="contact-h" className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Contact</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              The best way to reach us is by email: <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to reply within a few working days.
            </p>
          </div>
          <Button asChild variant="hero" size="lg" className="shrink-0"><Link to="/">Value a car free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
