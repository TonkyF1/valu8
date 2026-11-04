/**
 * Valu8 — £2.99 Full Valuation Report via Stripe Embedded Checkout.
 * Rendered by Report.tsx ONLY when premiumEnforced() is true (VITE_PREMIUM_ENFORCED=true),
 * so it is invisible while charging is off. Unlock comes from the webhook-written
 * report_purchases row (report-entitlement), never from the return URL.
 */
import { useCallback, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Lock, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: ReturnType<typeof loadStripe> | null = null;
const getStripe = () => (stripePromise ??= PK ? loadStripe(PK) : Promise.resolve(null));

const BULLETS = [
  "MOT red flags & recurring advisories",
  "Outstanding recall check",
  "Fair-price verdict & offer guidance",
  "Questions to ask the seller",
  "Premium PDF report",
];

export function ReportCheckout({ valuationId, verifying, onPaid }: { valuationId: string; verifying?: boolean; onPaid?: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("create-checkout-session", { body: { valuationId } });
    const d = data as any;
    if (d?.alreadyPaid) { onPaid?.(); throw new Error("already paid"); }
    if (error || !d?.clientSecret) {
      setError("Checkout isn't available right now. Please try again shortly.");
      throw new Error("no client secret");
    }
    return d.clientSecret as string;
  }, [valuationId, onPaid]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (!PK) return null;

  return (
    <section
      aria-label="Full Valuation Report"
      className="mb-6 rounded-2xl border border-white/10 p-5 md:p-6"
      style={{ background: "#111111", color: "#F7F5F3", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {verifying ? (
        <div className="flex items-center gap-3" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00D6C8] border-t-transparent" />
          <p className="text-sm">Confirming your payment… your Full Report will unlock in a moment.</p>
        </div>
      ) : !open ? (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FDE047" }}>
              <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Full Valuation Report
            </p>
            <h2 className="mt-1 text-xl font-bold md:text-2xl">Unlock the full picture for £2.99</h2>
            <ul className="mt-3 grid gap-1 text-sm opacity-90 sm:grid-cols-2">
              {BULLETS.map((b) => (
                <li key={b} className="flex gap-2"><span style={{ color: "#00D6C8" }}>✓</span>{b}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:items-end">
            <button
              type="button"
              onClick={() => { setError(null); setOpen(true); }}
              className="min-h-[48px] rounded-xl px-6 text-base font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047]"
              style={{ background: "#00D6C8", color: "#111111" }}
            >
              Get Full Report · £2.99
            </button>
            <p className="flex items-center gap-1 text-xs opacity-70"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure payment by Stripe · Apple Pay · Google Pay · Card</p>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Full Valuation Report · £2.99</h2>
            <button type="button" aria-label="Close checkout" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          {error ? (
            <p className="text-sm" style={{ color: "#FDE047" }}>{error}</p>
          ) : (
            // Embedded Checkout renders in a Stripe-hosted iframe; colours/fonts/buttons are set via
            // Dashboard → Settings → Branding (background #111111, button #00D6C8, Inter).
            <div className="overflow-hidden rounded-xl bg-white">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Webhook-backed entitlement (report_purchases). */
export async function fetchReportPaid(valuationId: string): Promise<boolean> {
  const { data } = await supabase.functions.invoke("report-entitlement", { body: { valuationId } });
  return !!(data as any)?.paid;
}
