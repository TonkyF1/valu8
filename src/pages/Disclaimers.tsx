import { useEffect } from "react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { ShieldAlert, Database, Sparkles, Scale } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/site";
import { useSeo } from "@/lib/seo";

export default function Disclaimers() {
  useSeo({ title: "Disclaimers & Data Sources — Valu8", description: "What a Valu8 report is and is not: data sources, AI use and limitations.", path: "/disclaimers" });
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Transparency</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Disclaimers &amp; Data Sources</h1>
        <p className="text-base text-muted-foreground mb-10">Honest small print so you know exactly what a Valu8 report is — and isn't.</p>

        <div className="space-y-4">
          <Card icon={<Sparkles className="h-4 w-4" />} title="AI-generated estimates">
            Each report combines live UK listings and DVSA data with a general-purpose AI model that reads your photos and details. Results are indicative and will vary from actual sale prices depending on local demand, time of year, and buyer competition.
          </Card>
          <Card icon={<Database className="h-4 w-4" />} title="Data sources">
            Live UK listing data is provided by MarketCheck (marketcheck.com). MOT history is retrieved from the official DVSA MOT History API. Where any provider is unavailable we fall back to a realistic estimate and label it clearly inside the report.
          </Card>
          <Card icon={<ShieldAlert className="h-4 w-4" />} title="Not financial advice">
            Valu8 reports do not constitute financial, legal, or commercial advice. Always carry out an independent HPI check and arrange a viewing/inspection before transacting.
          </Card>
          <Card icon={<Scale className="h-4 w-4" />} title="Liability">
            Valu8 accepts no liability for outcomes arising from reliance on a valuation. By using the service you acknowledge the indicative nature of the results.
          </Card>
        </div>

        <p className="text-xs text-muted-foreground mt-10">
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="premium-card p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-foreground/80">{children}</p>
    </div>
  );
}
