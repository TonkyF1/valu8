/**
 * Valu8 — £2.99 Full Valuation Report via Stripe Checkout Elements (ui_mode=elements).
 * Dark Appearance API (theme night) + own teal Pay button. Unlock comes from the
 * webhook-written report_purchases row (report-entitlement), never from the return URL.
 */
import { FormEvent, useCallback, useMemo, useState } from "react";
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

const BULLETS = [
  "Full comparable sales & price range",
  "Photo-by-photo condition notes",
  "Repair upside & seller tips",
  "Ownership costs & ready-to-post advert",
  "Shareable report & PDF download",
];

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
            buttonTheme: { applePay: "white-outline", googlePay: "white" },
            buttonHeight: 48,
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

function ElementsCheckout({ valuationId, email, onPaid, onClose }: { valuationId: string; email?: string; onPaid?: () => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    // Email is collected by ContactDetailsElement (pre-filled via defaultValues when
    // signed in). Do NOT send it here — create-checkout-session must not set
    // customer_email, or Elements throws "You cannot update the email…".
    const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      body: { valuationId },
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

  if (!PK) return null;

  return (
    <section
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FDE047" }}>
              <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Full Valuation Report
            </p>
            <h2 className="mt-1 text-xl font-bold md:text-2xl">Full report · £2.99 one-off</h2>
            <ul className="mt-3 grid gap-1 text-sm opacity-90 sm:grid-cols-2">
              {BULLETS.map((b) => (
                <li key={b} className="flex gap-2"><span style={{ color: "#00D6C8" }}>✓</span>{b}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-[48px] rounded-xl px-6 text-base font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047]"
              style={{ background: "#00D6C8", color: "#111111" }}
            >
              Unlock full report · £2.99
            </button>
            <p className="flex items-center gap-1 text-xs opacity-70"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure payment by Stripe · Apple Pay · Google Pay · Card</p>
          </div>
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
