import { useLocation } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { CONTACT_EMAIL } from "@/lib/site";
import { LEGAL_NAME } from "@/lib/legal";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";

export default function About() {
  const { pathname } = useLocation();
  const isContact = pathname.startsWith("/contact");
  useSeo(getRouteMeta(isContact ? "/contact" : "/about"));
  const operator = LEGAL_NAME.trim() || "Valu8";
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-3xl py-12 md:py-16 space-y-10">
        <header>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">{isContact ? "Contact" : "About"}</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-4">{isContact ? "Get in touch" : "About Valu8"}</h1>
          <p className="text-base text-muted-foreground">
            Valu8 (valu8.uk) is run by {operator}. It is an independent car valuation tool for UK private sellers and buyers.
          </p>
        </header>

        <section id="how-it-works" aria-labelledby="how-h">
          <h2 id="how-h" className="text-xl font-semibold mb-3">How valuations work</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>Where there are enough live UK dealer listings for your make and model, we anchor the price to them and adjust for age and mileage.</li>
            <li>When live listings are unavailable, the report shows an AI market estimate and says so clearly, so you can treat it as a guide.</li>
            <li>MOT history comes from the official DVSA database. Photo condition checks are done by AI.</li>
            <li>Every report shows its confidence level. Figures are estimates, not financial advice or a guaranteed sale price.</li>
          </ul>
        </section>

        <section aria-labelledby="ea-h" className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h2 id="ea-h" className="text-xl font-semibold mb-2">Early access</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Valu8 is new and still improving. All features are free during early access and no card is needed. Some valuations will be less precise than others while we grow our data, and we would rather tell you that than pretend otherwise.
          </p>
        </section>

        <section id="contact" aria-labelledby="contact-h">
          <h2 id="contact-h" className="text-xl font-semibold mb-2">Contact</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The best way to reach us is by email: <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to reply within a few working days.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
