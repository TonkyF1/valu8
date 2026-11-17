import "@/styles/buyerSeller.css";
import { useIntent, type Intent } from "@/lib/intent";
import { posthog } from "@/lib/posthog";

const BuyIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 9H6.2" /><circle cx="9.5" cy="20.5" r="1" /><circle cx="17.5" cy="20.5" r="1" />
  </svg>
);
const SellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
);

/**
 * Buying / Selling selector (one shared choice across the site). The teal thumb springs between
 * the two options; colours cross-fade. Sizes: lg (homepage section), sm (cards), xs (checkout).
 */
export function IntentSwitch({ size = "lg", labels, where, value, onChange, className = "" }: {
  size?: "lg" | "sm" | "xs"; labels?: [string, string]; where: string;
  value?: Intent; onChange?: (i: Intent) => void; className?: string;
}) {
  const [shared, setShared] = useIntent();
  const v = value ?? shared;
  const set = (i: Intent) => {
    if (i === v) return;
    onChange?.(i);
    setShared(i);
    try { posthog.capture?.("Intent Selected", { intent: i, where }); } catch { /* optional */ }
  };
  const [b, s] = labels ?? (size === "xs" ? ["Buying", "Selling"] : ["I’m Buying", "I’m Selling"]);
  return (
    <div className={`v8-intent v8-intent-${size} ${className}`} role="radiogroup" aria-label="Buying or selling" data-v={v} data-testid={`intent-${where}`}>
      <span className="v8-intent-thumb" aria-hidden />
      {([["buying", b, BuyIcon], ["selling", s, SellIcon]] as const).map(([k, label, Icon]) => (
        <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => set(k)}
          onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); set(k === "buying" ? "selling" : "buying"); } }}>
          {size !== "xs" && <Icon />}<span>{label}</span>
        </button>
      ))}
    </div>
  );
}
