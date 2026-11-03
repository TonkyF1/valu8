import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { CONTACT_EMAIL } from "@/lib/site";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";

/**
 * ICO registration number. PLACEHOLDER: fill in once Valu8 is registered with the ICO.
 * While empty, the page shows "Registration pending".
 */
export const ICO_REGISTRATION_NUMBER = "";

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>;

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{n}. {title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  useSeo(getRouteMeta("/privacy"));
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-3xl py-12 md:py-16">
        <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Legal</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-6">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: 3 November 2026</p>

        <div className="max-w-none space-y-8 text-sm leading-relaxed text-foreground/85">
          <Section n={1} title="Who we are">
            <p>Valu8 (valu8.uk) gives free car valuations to people in the United Kingdom. Valu8 is the data controller for the personal data described here. You can reach us at <Mail />.</p>
            <p>
              ICO registration number:{" "}
              {ICO_REGISTRATION_NUMBER
                ? <strong className="text-foreground">{ICO_REGISTRATION_NUMBER}</strong>
                : <span className="text-muted-foreground">registration pending (number will be added here)</span>}
            </p>
          </Section>

          <Section n={2} title="What we collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Your registration number</strong>, used to look up the car's official details and MOT history.</li>
              <li><strong className="text-foreground">Valuation inputs</strong>: make, model, trim, year, mileage, condition answers, notes, and any photos you choose to upload.</li>
              <li><strong className="text-foreground">Your email address (optional)</strong>: only if you create an account or ask us to email you, for example "Email me if this price changes".</li>
              <li><strong className="text-foreground">Anonymous funnel steps</strong>: which steps of the valuation form were reached (for example "registration entered" or "result seen"), a coarse traffic source (such as "facebook" or "direct"), a device type (mobile, tablet or desktop) and the time. This uses a random number that lives only in memory for that one page visit. It sets no cookies, stores nothing on your device and contains no personal data.</li>
              <li><strong className="text-foreground">How you found us</strong>: a campaign tag and referring site domain, kept in your browser's local storage (not a cookie).</li>
              <li><strong className="text-foreground">Analytics (only if you accept)</strong>: PostHog page and usage analytics, with text inputs masked. Nothing loads until you click "Accept analytics".</li>
            </ul>
          </Section>

          <Section n={3} title="Why we use it">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To produce and show your valuation, and to save it to your account (to provide the service you asked for).</li>
              <li>To send the emails you asked for, such as price-change alerts and follow-ups (your consent, which you can withdraw at any time).</li>
              <li>To see where people drop off in the form and make it easier to use, and to keep the service secure and prevent abuse (our legitimate interests).</li>
              <li>To improve our valuations, using an anonymised copy of vehicle and price details with your email, registration and photos removed (our legitimate interests).</li>
              <li>Optional analytics (your consent).</li>
            </ul>
            <p>We never sell your personal data and we do not use it for advertising.</p>
          </Section>

          <Section n={4} title="Who processes it for us">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Supabase</strong> (via Lovable Cloud): our processor for hosting, the database, sign-in and photo storage.</li>
              <li>Lovable AI gateway: reads vehicle details and photos to produce the report. Submissions are not used to train external models.</li>
              <li>DVSA MOT History API and vehicle data lookups: return official records for the registration you enter.</li>
              <li>Our email provider: sends the emails you asked for.</li>
              <li>Cloudflare Turnstile: bot protection.</li>
              <li>PostHog (EU): analytics, only with your consent.</li>
            </ul>
            <p>Each processor acts only on our instructions. Where data leaves the UK, it is protected by appropriate safeguards such as the UK International Data Transfer Addendum.</p>
          </Section>

          <Section n={5} title="How long we keep it">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Account and saved valuations: until you delete them or your account.</li>
              <li>Guest valuations (no account): kept so your link keeps working; ask us and we will delete them.</li>
              <li>Email for alerts: until you unsubscribe or ask us to delete it.</li>
              <li>Anonymous funnel steps: up to 13 months.</li>
              <li>Anonymised vehicle and price records: kept to improve our valuations, as they no longer identify you.</li>
            </ul>
          </Section>

          <Section n={6} title="Your rights">
            <p>Under UK GDPR you can ask to access, correct, export or delete your personal data, and to object to or restrict how we use it. You can withdraw consent for emails at any time using the unsubscribe link in any email.</p>
            <p>To delete your data, or for any other request, email <Mail />. You can also delete valuations from your dashboard and your whole account from your profile page. We will reply within one month.</p>
            <p>If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ico.org.uk</a>.</p>
          </Section>

          <Section n={7} title="Cookies and browser storage">
            <p>We use only essential browser storage: to keep you signed in, to remember your cookie choice, to remember how you first found us and, for guests, a random token so you can reopen your own valuations. The funnel steps above use no cookies or storage at all. Analytics cookies are set only if you accept them, and you can change your choice any time via "Cookie settings" in the footer.</p>
          </Section>

          <Section n={8} title="Contact">
            <p><Mail /></p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
