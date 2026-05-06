import { useEffect } from "react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { ShieldAlert, Database, Sparkles, Scale } from "lucide-react";

export default function Disclaimers() {
  useEffect(() => { document.title = "Disclaimers & Data Sources — Valu8"; }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Transparency</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Disclaimers &amp; Data Sources</h1>
        <p className="text-base text-muted-foreground mb-10">Honest small print so you know exactly what a Valu8 report is — and isn't.</p>

        <div className="space-y-4">
          <Card icon={<Sparkles className="h-4 w-4" />} title="AI-generated estimates">
            Each report is produced by a large vision-and-language model trained on UK market data and your vehicle photos and details. Results are indicative and will vary from actual sale prices depending on local demand, time of year, and buyer competition.
          </Card>
          <Card icon={<Database className="h-4 w-4" />} title="Data sources">
            Pricing benchmarks are derived from public UK retail and trade listings. HPI and MOT summaries shown in Test Mode are realistic simulations — once production keys for the official DVSA MOT History API and an HPI provider (e.g. RegCheck, MotorCheck, HPI Ltd) are configured, real records will replace the simulated data automatically.
          </Card>
          <Card icon={<ShieldAlert className="h-4 w-4" />} title="Not financial advice">
            Valu8 reports do not constitute financial, legal, or commercial advice. Always carry out an independent HPI check and arrange a viewing/inspection before transacting.
          </Card>
          <Card icon={<Scale className="h-4 w-4" />} title="Liability">
            Valu8 accepts no liability for outcomes arising from reliance on a valuation. By using the service you acknowledge the indicative nature of the results.
          </Card>
        </div>

        <p className="text-xs text-muted-foreground mt-10">
          Questions? Email <a href="mailto:hello@valu8.app" className="text-primary hover:underline">hello@valu8.app</a>.
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
