import { useEffect } from "react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";

export default function Terms() {
  useEffect(() => { document.title = "Terms of Service — Valu8"; }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: 6 May 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/85">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance</h2>
            <p>By using Valu8 you agree to these terms. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">2. The service</h2>
            <p>Valu8 generates indicative AI valuations for used vehicles in the UK private sale market. The service is provided "as is" and is currently in Test Mode — all features are free.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Acceptable use</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Submit only vehicles you own or are authorised to value.</li>
              <li>Do not upload photos containing third-party personal data (e.g. people, number plates of other vehicles).</li>
              <li>Do not attempt to reverse-engineer, scrape, or abuse the service.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Accuracy &amp; no warranty</h2>
            <p>Valuations are estimates only and may vary materially from actual sale prices. Valu8 provides no warranty as to accuracy, fitness for purpose, or merchantability.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Liability</h2>
            <p>To the maximum extent permitted by law, Valu8 is not liable for losses arising from reliance on a valuation, including missed sale opportunities or undervaluation/overvaluation.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Account termination</h2>
            <p>We may suspend or terminate accounts that breach these terms. You may close your account at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Governing law</h2>
            <p>These terms are governed by the laws of England &amp; Wales.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
