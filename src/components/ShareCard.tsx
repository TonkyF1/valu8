import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Gift, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/data/routeMeta";
import { peekGuestToken } from "@/lib/guest";
import { track } from "@/lib/funnel";
import { posthog } from "@/lib/posthog";
import { renderShareCard, shareFileName, type ShareCardData } from "@/lib/shareImage";

export const REFERRAL_COPY = "Share with a friend. When they value their car, your full report is free.";

/** Public link for a shared valuation: the homepage (reg box first), tagged, with the share code. Never the report URL. */
export function shareCardUrl(code?: string | null): string {
  const q = new URLSearchParams({ utm_source: "share", utm_medium: "referral", utm_campaign: "result_card" });
  if (code && /^[a-z0-9]{10}$/.test(code)) q.set("ref", code);
  return `${SITE_URL}/?${q.toString()}`;
}

export const shareCardText = (car: string, value: string) => `Valu8 values my ${car} at ${value} (private sale estimate). What's yours worth? Free valuation from your number plate:`;

/** Owner's share code for this valuation (created on first call) and whether a friend has redeemed it. */
async function fetchShareLink(valuationId: string): Promise<{ code: string; redeemed: boolean } | null> {
  const { data, error } = await supabase.functions.invoke("referral", { body: { action: "link", valuationId, guestToken: peekGuestToken() ?? undefined } });
  const d = data as any;
  if (error || !d?.code) return null;
  return { code: String(d.code), redeemed: !!d.redeemed };
}

/**
 * "Share my valuation": native share sheet with a downloadable image card, plus the referral offer
 * while the full report is still locked. Shown to the valuation's owner only (never on /shared/ links).
 */
export function ShareCard({ valuationId, card, locked, onUnlocked }: {
  valuationId: string; card: ShareCardData; locked: boolean; onUnlocked?: () => void;
}) {
  const [link, setLink] = useState<{ code: string; redeemed: boolean } | null>(null);
  const [showPlate, setShowPlate] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const data = useMemo<ShareCardData>(() => ({ ...card, plate: showPlate ? card.plate : null }), [card, showPlate]);

  useEffect(() => {
    let live = true;
    fetchShareLink(valuationId).then((l) => {
      if (!live || !l) return;
      setLink(l);
      if (l.redeemed && locked) onUnlocked?.();
    }).catch(() => { /* share still works without a code */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuationId]);

  // Draw the card (and redraw when the plate toggle changes) for the preview and the share sheet.
  useEffect(() => {
    let live = true; let url: string | null = null;
    blobRef.current = null;
    renderShareCard(data).then((b) => {
      if (!live || !b) return;
      blobRef.current = b;
      url = URL.createObjectURL(b);
      setPreview(url);
    }).catch(() => { /* preview optional */ });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [data]);

  const url = shareCardUrl(link?.code);
  const text = shareCardText(card.car, card.value);
  const fileName = shareFileName(card.car);
  const capture = (method: string) => { try { posthog.capture?.("result_shared", { method, campaign: "result_card" }); } catch { /* optional */ } };

  const download = async () => {
    const b = blobRef.current ?? (await renderShareCard(data));
    if (!b) { toast.error("Couldn't make the image"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    capture("download");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast.success("Link copied", { description: "Paste it anywhere to share." }); capture("copy"); }
    catch { toast.error("Couldn't copy", { description: url }); }
  };
  const whatsapp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer"); capture("whatsapp"); };

  const share = async () => {
    track("share_click");
    setBusy(true);
    try {
      const b = blobRef.current ?? (await renderShareCard(data));
      const file = b ? new File([b], fileName, { type: "image/png" }) : null;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (file && nav.share && nav.canShare?.({ files: [file] })) {
        // Some apps drop `url` when files are attached, so the link goes in the text as well.
        await nav.share({ files: [file], title: "My Valu8 valuation", text: `${text} ${url}` });
        capture("native_image");
      } else if (nav.share) {
        await nav.share({ title: "My Valu8 valuation", text, url });
        capture("native_link");
      } else {
        await copy();
      }
    } catch { /* share sheet closed */ }
    finally { setBusy(false); }
  };

  const unlocked = !!link?.redeemed;
  return (
    <section id="share-valuation" aria-labelledby="share-valuation-h" className="mb-6 rounded-2xl border p-5 md:p-6" style={{ background: "#111111", color: "#F7F5F3", borderColor: "rgba(0,214,200,0.35)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          {locked && !unlocked ? (
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00D6C8" }}><Gift className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Free full report</p>
          ) : null}
          <h2 id="share-valuation-h" className="mt-1 text-xl font-bold">{locked && !unlocked ? "Get your full report free" : "Share my valuation"}</h2>
          {locked && !unlocked ? (
            <p className="mt-2 text-sm opacity-90">{REFERRAL_COPY}</p>
          ) : unlocked ? (
            <p className="mt-2 text-sm" style={{ color: "#00D6C8" }}>A friend valued their car with your link, so your full report is unlocked. Thank you for sharing.</p>
          ) : (
            <p className="mt-2 text-sm opacity-90">Send your result as an image. Friends see the car and the price only, never your report.</p>
          )}
          <button type="button" onClick={share} disabled={busy}
            className="mt-4 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE047] disabled:opacity-60 md:w-auto"
            style={{ background: "#00D6C8", color: "#111111" }}>
            <Share2 className="h-5 w-5" aria-hidden /> Share my valuation
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Download image", icon: <Download className="h-4 w-4" aria-hidden />, onClick: download },
              { label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" aria-hidden />, onClick: whatsapp },
              { label: "Copy link", icon: <Copy className="h-4 w-4" aria-hidden />, onClick: copy },
            ].map((b) => (
              <button key={b.label} type="button" onClick={b.onClick} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium hover:bg-white/5">{b.icon}{b.label}</button>
            ))}
          </div>
          <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm opacity-90">
            <input type="checkbox" className="h-4 w-4 accent-[#00D6C8]" checked={showPlate} onChange={(e) => setShowPlate(e.target.checked)} disabled={!card.plate} />
            Show my number plate on the image
          </label>
          <p className="mt-1 text-[11px] opacity-60">
            {locked && !unlocked
              ? "Your friend values their own car through your link. One free report per valuation. We never show you their details."
              : "Your link opens the Valu8 homepage. It never opens your report."}
          </p>
        </div>
        {preview ? (
          <img src={preview} alt={`Share image: ${card.car}, ${card.value}`} width={216} height={270} className="mx-auto w-[216px] shrink-0 rounded-xl border border-white/10 md:mx-0" />
        ) : null}
      </div>
    </section>
  );
}

/** Friend side: once a visitor who arrived on a share link finishes their own valuation, credit the sharer once. */
export async function completeReferral(code: string, valuationId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.functions.invoke("referral", { body: { action: "complete", code, valuationId, guestToken: peekGuestToken() ?? undefined } });
  if (error) return { ok: false, reason: "error" };
  return { ok: !!(data as any)?.ok, reason: (data as any)?.reason };
}
