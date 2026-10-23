import { operatorSentence } from "@/lib/legal";
import { useEffect } from "react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { CONTACT_EMAIL } from "@/lib/site";
import { useSeo } from "@/lib/seo";

export default function Privacy() {
  useSeo({ title: "Privacy Policy — Valu8", description: "How Valu8 collects, uses and protects your data under UK GDPR.", path: "/privacy" });
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: 23 October 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-foreground/85">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Who we are</h2>
            <p>Valu8 ("we", "us") provides car valuations to private sellers in the United Kingdom. {operatorSentence()} Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Account data: email address and sign-in details.</li>
              <li>Vehicle data: make, model, year, mileage, registration, MOT expiry, and any notes you submit.</li>
              <li>Photos: images you upload of your vehicle.</li>
              <li>How you found us: if you arrive from a link, we keep the campaign tag (utm_source, utm_medium, utm_campaign) and the referring website's domain with your account and valuations. This is stored in your browser's local storage, not a cookie, and contains no identifiers.</li>
              <li>Usage data (only if you accept analytics): pages visited, device type and session recordings with text inputs masked.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How we use it and our lawful basis</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To create, store and show your valuation reports (contract: providing the service you asked for).</li>
              <li>To keep the service secure and prevent abuse (legitimate interests).</li>
              <li>To understand which links and pages bring people to Valu8 (legitimate interests).</li>
              <li>To improve the accuracy of our valuations and build our pricing database (legitimate interests, see below).</li>
              <li>Analytics and session replay (consent, which you can withdraw at any time).</li>
            </ul>
            <p className="mt-2"><strong>Improving our valuations.</strong> We keep the vehicle details you enter (make, model, trim, year, mileage, condition answers and specification), the valuation we produce and, if you tell us, the price your car sold for. We make an anonymised copy of this with your name, email, registration and photos removed, and use it to build our pricing database and make Valu8 valuations more accurate. Our lawful basis is our legitimate interest in providing accurate valuations. Once anonymised, these records no longer identify you and are not personal data. We do not record your location.</p>
            <p className="mt-2">We never sell your personal data and we do not use it for advertising.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Who processes it for us</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Lovable Cloud / Supabase: hosting, database, sign-in and photo storage.</li>
              <li>Lovable AI gateway: reads your vehicle details and photos to produce the report. Submissions are not used to train external models.</li>
              <li>DVSA MOT History API and vehicle data lookups: fetch official records for the registration you enter.</li>
              <li>Cloudflare Turnstile: bot protection on sign-in.</li>
              <li>PostHog (EU): analytics, only with your consent.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Retention</h2>
            <p>We keep your account and saved valuations until you delete them. You can delete any valuation from your dashboard, which removes its photos and report, and you can delete your whole account from your profile page. Your registration, photos and reports linked to your account are kept only for as long as needed to provide your account, and you can ask us to delete your account data at any time by emailing <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.</p>
            <p className="mt-2">Anonymised vehicle and price records (with no name, email, registration or photos) are kept indefinitely to build our pricing database, as they no longer identify you.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Your rights (UK GDPR)</h2>
            <p>You have the right to access, correct, export, or delete your personal data, and to object to or restrict how we use it. Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a> to exercise these rights. If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ico.org.uk</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cookies and similar storage</h2>
            <p>We use essential browser storage to keep you signed in and to remember your cookie choice and how you first found us. With your consent only, we use PostHog analytics (including session replay with text inputs masked). Analytics does not load until you click "Accept analytics", and you can change your choice at any time via "Cookie settings" in the footer. We do not use advertising cookies.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
            <p><a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a></p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
