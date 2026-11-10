/**
 * Valu8 — £2.99 Full Valuation Report via Stripe Checkout Elements (ui_mode=elements).
 * Dark Appearance API (theme night) + own teal Pay button. Unlock comes from the
 * webhook-written report_purchases row (report-entitlement), never from the return URL.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { Lock, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PUBLISHABLE_KEY } from "@/config/stripePublic";
import { useAuth } from "@/contexts/AuthContext";
import { funnelDevice, funnelSessionId, track } from "@/lib/funnel";
import { metaPixelLoaded } from "@/lib/metaPixel";

const PK = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || STRIPE_PUBLISHABLE_KEY;
let stripePromise: ReturnType<typeof loadStripe> | null = null;
const getStripe = () => (stripePromise ??= PK ? loadStripe(PK) : Promise.resolve(null));

const INTER_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

const APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorBackground: "#111111",
    colorText: "#F7F5F3",
    colorPrimary: "#00D6C8",
    colorDanger: "#F87171",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px",
  },
  rules: {
    ".Input": {
      backgroundColor: "#1a1a1a",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
    ".Tab": {
      backgroundColor: "#1a1a1a",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
  },
};

/** Already on the free result. */
export const FREE_INCLUDES = ["Private sale estimate for your car", "Confidence level and the data behind it"];
export const FREE_SUMMARY = "Already free: your private sale estimate, its confidence level and the data behind it. The report adds:";
/** Exactly what the £2.99 report adds on top (everything below is in the paid report today). */
export const REPORT_ADDS = [
  "A suggested asking price for your advert",
  "The lowest offer to accept, so you know when to say yes",
  "The UK adverts we compared your car with",
  "Your full MOT history, with repair cost bands for advisories",
  "Strengths and watch points a buyer will spot, from your MOT record and photos",
  "Where to sell, what to highlight and which documents to have ready",
  "Ready-to-post advert text",
  "A PDF of the full report to keep or send to buyers",
];
/** Offer button: says what you get, not "full report". */
export const REPORT_CTA = "See my asking price · £2.99";

/** One honest line under the free price: what the £2.99 report actually adds to this figure. */
export function reportOfferLine({ isRange }: { isRange: boolean }): string {
  const lead = isRange ? "The £2.99 report narrows this range to one suggested asking price" : "The £2.99 report turns this into one suggested asking price";
  return `${lead} and the lowest offer worth accepting, plus advert text ready to post.`;
}

/** Report preview. Every figure is an example, never the visitor's car, and is labelled as such. */
const PREVIEW: { label: string; value: string; blur?: boolean }[] = [
  { label: "Suggested asking price", value: "£4,950", blur: true },
  { label: "Accept offers from", value: "£4,600", blur: true },
  { label: "Comparable adverts", value: "12 similar cars, 3 shown, rest locked" },
  { label: "MOT advisories to fix", value: "Front tyres, cost band shown when unlocked" },
  { label: "Advert text", value: "First line visible, rest locked" },
];

function ReportPreview() {
  return (
    <div className="rounded-xl border border-white/10 p-3 sm:p-4" style={{ background: "#1a1a1a" }} aria-label="Report preview with example figures">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Report preview</p>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: "#FDE047", color: "#111111" }}>Example</span>
      </div>
      <dl className="divide-y divide-white/10 text-sm">
        {PREVIEW.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="opacity-80">{row.label}</dt>
            <dd className="text-right font-semibold tabular-nums">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#FDE047" }}>Example:</span>
              <span className={row.blur ? "select-none blur-[5px]" : "opacity-90"} aria-hidden={row.blur ? true : undefined}>{row.value}</span>
              {row.blur && <span className="sr-only">hidden until unlocked</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] opacity-60">Example figures only, not your car. Your own figures appear when you unlock.</p>
    </div>
  );
}

function returnUrlFor(valuationId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://valu8.uk";
  return `${origin}/valuation/${valuationId}?session_id={CHECKOUT_SESSION_ID}`;
}

function CheckoutForm({ valuationId, onError }: { valuationId: string; onError: (msg: string) => void }) {
  const checkoutState = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [expressReady, setExpressReady] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div className="flex items-center gap-3 py-6" role="status">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00D6C8] border-t-transparent" />
        <p className="text-sm opacity-80">Loading secure checkout…</p>
      </div>
    );
  }
  if (checkoutState.type === "error") {
    return <p className="text-sm" style={{ color: "#FDE047" }}>{checkoutState.error.message || "Checkout failed to load."}</p>;
  }

  const checkout = checkoutState.checkout;
  const returnUrl = returnUrlFor(valuationId);

  const confirm = async (opts?: { expressCheckoutConfirmEvent?: unknown }) => {
    setSubmitting(true);
    onError("");
    try {
      const result = await checkout.confirm({ returnUrl, ...(opts as object) });
      if (result.type === "error") {
        onError(result.error.message || "Payment failed. Please try again.");
        setSubmitting(false);
      }
      // success / redirect handled by Stripe (return_url or same-page completion)
    } catch (e: any) {
      onError(e?.message || "Payment failed. Please try again.");
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    await confirm();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className={expressReady ? "" : "hidden"}>
        <ExpressCheckoutElement
          onReady={(e) => {
            const methods = (e as { availablePaymentMethods?: Record<string, boolean> | null })?.availablePaymentMethods;
            setExpressReady(!!methods && Object.values(methods).some(Boolean));
          }}
          onConfirm={(event) => { void confirm({ expressCheckoutConfirmEvent: event }); }}
          options={{
            buttonType: { applePay: "buy", googlePay: "pay" },
            buttonTheme: { applePay: "white-outline", googlePay: "white" },
            buttonHeight: 48,
            layout: { overflow: "auto" },
            paymentMethodOrder: ["apple_pay", "google_pay"],
            paymentMethods: { applePay: "auto", googlePay: "auto" },
          }}
        />
        <div className="relative my-3 text-center text-xs uppercase tracking-wider opacity-50">
          <span className="relative z-10 bg-[#111111] px-3">Or pay with card</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/10" aria-hidden />
        </div>
      </div>

      <ContactDetailsElement />
      <PaymentElement options={{ layout: "tabs" }} />

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full min-h-[48px] items-center justify-center rounded-xl px-6 text-base font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047] disabled:opacity-60"
        style={{ background: "#00D6C8", color: "#111111" }}
      >
        {submitting ? "Processing…" : "Pay £2.99"}
      </button>
      <p className="flex items-center justify-center gap-1 text-xs opacity-70">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure payment by Stripe · Apple Pay · Google Pay · Card
      </p>
    </form>
  );
}

export function ElementsCheckout({ valuationId, email, onPaid, onClose }: { valuationId: string; email?: string; onPaid?: () => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    // Email is collected by ContactDetailsElement (pre-filled via defaultValues when
    // signed in). Do NOT send it here — create-checkout-session must not set
    // customer_email, or Elements throws "You cannot update the email…".
    track("checkout_start");
    track("report_checkout");
    const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      // Anonymous funnel id + device class so the webhook can log report_purchased; metaConsent only
      // true when the visitor accepted advertising cookies and the Meta Pixel is switched on.
      body: { valuationId, funnelSession: funnelSessionId(), funnelDevice: funnelDevice(), metaConsent: metaPixelLoaded() },
    });
    const d = data as any;
    if (d?.alreadyPaid) { onPaid?.(); throw new Error("already paid"); }
    if (fnErr || !d?.clientSecret) {
      setError("Checkout isn't available right now. Please try again shortly.");
      throw new Error("no client secret");
    }
    return d.clientSecret as string;
  }, [valuationId, onPaid]);

  const options = useMemo(
    () => ({
      clientSecret: fetchClientSecret(),
      elementsOptions: {
        appearance: APPEARANCE,
        fonts: [{ cssSrc: INTER_CSS }],
        loader: "auto" as const,
      },
      defaultValues: email ? { email } : undefined,
    }),
    [fetchClientSecret, email],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Full Valuation Report · £2.99</h2>
        <button type="button" aria-label="Close checkout" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      {error ? (
        <p className="mb-3 text-sm" style={{ color: "#FDE047" }}>{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-white/10 p-3 sm:p-4" style={{ background: "#111111" }}>
        <CheckoutElementsProvider stripe={getStripe()} options={options}>
          <CheckoutForm valuationId={valuationId} onError={(msg) => setError(msg || null)} />
        </CheckoutElementsProvider>
      </div>
    </div>
  );
}

export function ReportCheckout({ valuationId, verifying, onPaid }: { valuationId: string; verifying?: boolean; onPaid?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const email = user?.email || undefined;
  const sectionRef = useRef<HTMLElement>(null);

  // Anonymous funnel: fire offer_view once when the £2.99 offer first scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) { track("offer_view"); io.disconnect(); }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!PK) return null;

  return (
    <section
      ref={sectionRef}
      id="report-checkout"
      aria-label="Full Valuation Report"
      className="mb-6 rounded-2xl border border-white/10 p-5 md:p-6"
      style={{ background: "#111111", color: "#F7F5F3", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {verifying ? (
        <div className="flex items-center gap-3" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00D6C8] border-t-transparent" />
          <p className="text-sm">Unlocking your report…</p>
        </div>
      ) : !open ? (
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FDE047" }}>
              <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Full report · £2.99
            </p>
            <h2 className="mt-1 text-xl font-bold md:text-2xl">Know your asking price before you list</h2>
            <p className="mt-2 text-sm opacity-90">Your free valuation shows what the car is worth. The full report shows what to ask, how far to drop and what to fix first.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:max-w-sm">
            <button
              type="button"
              onClick={() => { track("offer_click"); setOpen(true); }}
              className="min-h-[48px] rounded-xl px-6 text-base font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047]"
              style={{ background: "#00D6C8", color: "#111111" }}
              data-testid="offer-button"
            >
              {REPORT_CTA}
            </button>
            <p className="text-center text-xs opacity-80">One-off payment. No subscription. We don't buy cars.</p>
            <p className="flex items-center justify-center gap-1 text-xs opacity-70"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure payment by Stripe · Apple Pay · Google Pay · Card</p>
          </div>
          <details className="group rounded-xl border border-white/10" data-testid="whats-in-report">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold">
              <span>What's in the report</span>
              <span aria-hidden className="text-lg leading-none transition-transform group-open:rotate-45" style={{ color: "#00D6C8" }}>+</span>
            </summary>
            <div className="grid gap-3 px-4 pb-4">
              <p className="text-xs opacity-70">{FREE_SUMMARY}</p>
              <ul className="grid gap-1 text-sm opacity-90">
                {REPORT_ADDS.map((b) => (<li key={b} className="flex gap-2"><span style={{ color: "#00D6C8" }}>✓</span>{b}</li>))}
              </ul>
              <ReportPreview />
            </div>
          </details>
          <a href="#share-valuation" className="text-center text-xs font-medium underline underline-offset-2" style={{ color: "#00D6C8" }}>Or share with a friend. When they value their car, your full report is free.</a>
        </div>
      ) : (
        <ElementsCheckout
          valuationId={valuationId}
          email={email}
          onPaid={onPaid}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

/** Webhook-backed entitlement (report_purchases). */
export async function fetchReportPaid(valuationId: string): Promise<boolean> {
  const { data } = await supabase.functions.invoke("report-entitlement", { body: { valuationId } });
  return !!(data as any)?.paid;
}
