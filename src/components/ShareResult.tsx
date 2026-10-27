import { useEffect, useState, type ReactNode } from "react";
import { Copy, Facebook, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CAR_MODELS, slugify } from "@/data/carModels";
import { SITE_URL } from "@/data/routeMeta";
import { posthog } from "@/lib/posthog";
import { toast } from "sonner";

export type SharePlatform = "whatsapp" | "x" | "facebook" | "copy" | "native";

/**
 * Public link for a shared result. Points at the model's /car-values page (static
 * title, description and OG image, so WhatsApp/X/Facebook show a proper preview) or
 * the home page. Never contains the registration, the report id or any personal data.
 */
export function buildShareUrl(opts: { make?: string | null; model?: string | null; platform: SharePlatform; campaign: string; ref?: string | null; path?: string }): string {
  const mk = slugify(opts.make ?? "");
  const md = slugify(opts.model ?? "");
  // "FIESTA ZETEC" -> /car-values/ford/fiesta
  const car = mk && md ? CAR_MODELS.find((c) => c.makeSlug === mk && (md === c.slug || md.startsWith(`${c.slug}-`))) : undefined;
  const path = opts.path ?? (car ? `/car-values/${car.makeSlug}/${car.slug}` : "/");
  const q = new URLSearchParams({ utm_source: opts.platform, utm_medium: "share", utm_campaign: opts.campaign });
  if (opts.ref && /^[a-z0-9]{6,16}$/.test(opts.ref)) q.set("ref", opts.ref);
  return `${SITE_URL}${path}?${q.toString()}`;
}

export function shareIntentUrl(platform: "whatsapp" | "x" | "facebook", text: string, url: string): string {
  if (platform === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  if (platform === "x") return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

let cached: { uid: string; code: string; joined: number } | null = null;
/** Signed-in user's referral code + friends joined (created on first use). Null for guests. */
export function useMyReferral(): { code: string; joined: number } | null {
  const { user } = useAuth();
  const [ref, setRef] = useState(cached && user && cached.uid === user.id ? cached : null);
  useEffect(() => {
    if (!user) { setRef(null); return; }
    if (cached?.uid === user.id) { setRef(cached); return; }
    let live = true;
    (supabase as any).rpc("my_referral").then(({ data, error }: any) => {
      if (error || !data?.code || !live) return;
      cached = { uid: user.id, code: String(data.code), joined: Number(data.joined) || 0 };
      setRef(cached);
    });
    return () => { live = false; };
  }, [user?.id]);
  return ref;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);

/** WhatsApp / X / Facebook / copy buttons. `text` must not contain personal data. */
export function ShareButtons({ text, make, model, campaign, path, onShared }: {
  text: string; make?: string | null; model?: string | null; campaign: string; path?: string; onShared?: (p: SharePlatform) => void;
}) {
  const ref = useMyReferral();
  const url = (platform: SharePlatform) => buildShareUrl({ make, model, platform, campaign, ref: ref?.code, path });
  const track = (platform: SharePlatform) => {
    try { posthog.capture?.("result_shared", { platform, campaign }); } catch { /* optional */ }
    onShared?.(platform);
  };
  const open = (platform: "whatsapp" | "x" | "facebook") => {
    window.open(shareIntentUrl(platform, text, url(platform)), "_blank", "noopener,noreferrer");
    track(platform);
  };
  const copy = async () => {
    const link = url("copy");
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      toast.success("Copied", { description: "Paste it anywhere to share." });
      track("copy");
    } catch { toast.error("Couldn't copy", { description: link }); }
  };
  const native = async () => {
    try { await navigator.share({ title: "Valu8", text, url: url("native") }); track("native"); } catch { /* cancelled */ }
  };
  const btn = (label: string, icon: ReactNode, onClick: () => void) => (
    <Button type="button" variant="outline" size="sm" className="min-h-[44px] sm:min-h-9 gap-2" onClick={onClick}>{icon}<span>{label}</span></Button>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {btn("WhatsApp", <MessageCircle className="h-4 w-4" aria-hidden />, () => open("whatsapp"))}
      {btn("X", <XIcon />, () => open("x"))}
      {btn("Facebook", <Facebook className="h-4 w-4" aria-hidden />, () => open("facebook"))}
      {btn("Copy link", <Copy className="h-4 w-4" aria-hidden />, copy)}
      {typeof navigator !== "undefined" && "share" in navigator && btn("More", <Share2 className="h-4 w-4" aria-hidden />, native)}
    </div>
  );
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

/**
 * "Share your result" card: the car, the Valu8 range and the verdict, nothing else
 * (no registration, mileage, photos or report link).
 */
export function ShareResult({ year, make, model, low, high, verdict, kind, extra }: {
  year?: number | null; make: string; model: string; low: number; high: number;
  verdict?: string | null; kind: "valuation" | "check"; extra?: ReactNode;
}) {
  const car = `${year ? `${year} ` : ""}${make} ${model}`.trim();
  const range = `${gbp(low)}–${gbp(high)}`;
  const text = kind === "check"
    ? `Valu8 says this ${car} is ${verdict ? verdict.toLowerCase() : "priced"}: private sale range ${range}. Check any used car advert free:`
    : `Valu8 values my ${car} at ${range} private sale${verdict ? ` (${verdict})` : ""}. Free, honest car valuations:`;
  return (
    <section aria-labelledby="share-result-h" className="premium-card p-5 sm:p-6 mt-6">
      <h2 id="share-result-h" className="text-base font-semibold">Share your result</h2>
      <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valu8 {kind === "check" ? "price check" : "valuation"}</p>
        <p className="font-semibold mt-1">{car}</p>
        <p className="text-lg font-bold tabular-nums text-primary">{range} <span className="text-xs font-medium text-muted-foreground">private sale</span></p>
        {verdict && <p className="text-sm mt-1"><span className="text-muted-foreground">Verdict:</span> <span className="font-medium">{verdict}</span></p>}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Friends see the car and price range only, never your registration or report.</p>
      <div className="mt-3"><ShareButtons text={text} make={make} model={model} campaign={kind === "check" ? "check_result" : "result_card"} /></div>
      {extra}
    </section>
  );
}
