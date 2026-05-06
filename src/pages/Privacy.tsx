import { useEffect } from "react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";

export default function Privacy() {
  useEffect(() => { document.title = "Privacy Policy — Valu8"; }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: 6 May 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-foreground/85">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Who we are</h2>
            <p>Valu8 ("we", "us") provides AI-powered car valuations to private sellers in the United Kingdom. This policy explains what personal data we collect and how we use it.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Account data: email address and authentication credentials.</li>
              <li>Vehicle data: make, model, year, mileage, registration, MOT expiry, and any service notes you submit.</li>
              <li>Photos: images you upload of your vehicle.</li>
              <li>Usage data: timestamps, pages visited, and basic device information.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How we use it</h2>
            <p>To generate your valuation report, store it in your account, improve our AI models in aggregate, and to maintain the security of the service. We never sell your personal data.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">4. AI processing</h2>
            <p>Vehicle details and photos are processed by third-party AI providers strictly to generate your report. Submissions are not used to train external models.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Storage &amp; retention</h2>
            <p>Your data is stored securely on UK/EU infrastructure. You may delete any saved valuation from your dashboard at any time, which removes the associated photos and report.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Your rights (UK GDPR)</h2>
            <p>You have the right to access, correct, export, or delete your personal data. Contact us at privacy@valu8.app to exercise these rights.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
            <p>We use only essential cookies required to keep you signed in. We do not use advertising or tracking cookies.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p>privacy@valu8.app</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
