import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Loader2, SearchCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccuracyDisclaimer } from "@/components/AccuracyDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { posthog } from "@/lib/posthog";
import { functionErrorBody, getGuestToken, rememberGuestCheck } from "@/lib/guest";
import { AdvertFollowupCard } from "@/components/AdvertFollowupCard";
import { CheckOutcomePrompt } from "@/components/OutcomePrompt";
import { ShareButtons } from "@/components/ShareResult";
import { GuestMarketingConsent } from "@/components/MarketingConsent";
import { checkAdvert, parseMoney, type AdvertCheck, type AdvertVerdict } from "@/lib/advertCheck";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const DRAFT_KEY = "valu8_check_draft";

const VERDICT: Record<AdvertVerdict, { label: string; cls: string; ring: string; icon: typeof ThumbsUp; tip: string }> = {
  overpriced: { label: "Overpriced", cls: "text-red-400", ring: "border-red-400/40 bg-red-400/5", icon: ThumbsDown, tip: "The asking price is above what dealers are typically asking for similar cars. Negotiate hard or keep looking." },
  fair: { label: "Fair", cls: "text-primary", ring: "border-primary/40 bg-primary/5", icon: BadgeCheck, tip: "The asking price sits between a realistic private sale and typical dealer retail. Normal room to negotiate." },
  bargain: { label: "Bargain", cls: "text-emerald-400", ring: "border-emerald-400/40 bg-emerald-400/5", icon: ThumbsUp, tip: "Below what similar cars usually sell for privately. Worth a look, but check why: history, condition, write-off status." },
};

type SellerType = "dealer" | "private" | "unknown" | "";
type Form = { make: string; model: string; year: string; mileage: string; askingPrice: string; link: string; sellerType: SellerType };
const EMPTY: Form = { make: "", model: "", year: "", mileage: "", askingPrice: "", link: "", sellerType: "" };
const SELLERS: { v: Exclude<SellerType, "">; label: string }[] = [{ v: "dealer", label: "Dealer" }, { v: "private", label: "Private" }, { v: "unknown", label: "Not sure" }];

function loadDraft(): Form {
  try { return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}") }; } catch { return EMPTY; }
}

export default function Check() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState<Form>(loadDraft);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(AdvertCheck & { asking: number; sample: number; basis: string; source?: string; checkId: string | null; car: { make: string; model: string; year: number | null } }) | null>(null);
  const [noData, setNoData] = useState(false);
  const [guestLimit, setGuestLimit] = useState<string | null>(null);
  useSeo(getRouteMeta("/check"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const asking = parseMoney(f.askingPrice), mileage = parseMoney(f.mileage), year = Number(f.year);
    if (!Number.isFinite(asking) || !Number.isFinite(mileage) || !(year > 1980 && year <= new Date().getFullYear() + 1)) {
      toast.error("Check the year, mileage and asking price"); return;
    }
    setBusy(true); setRes(null); setNoData(false); setGuestLimit(null);
    try {
      const { data, error } = await supabase.functions.invoke("fair-price", {
        body: {
          make: f.make.trim(), model: f.model.trim(), year, mileage, askingPrice: asking,
          link: f.link.trim() || undefined, sellerType: f.sellerType || undefined,
          guestToken: user ? undefined : getGuestToken(),
        },
      });
      if (error) {
        const { status, body } = await functionErrorBody(error);
        // Guests are welcome; only fall back to sign-in if the backend still requires it.
        if (status === 401 && !user) {
          try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* ignore */ }
          navigate("/auth"); return;
        }
        if (status === 429 && body?.code === "guest_limit" && !user) {
          try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* ignore */ }
          setGuestLimit(body.error); return;
        }
        throw new Error(body?.error || "Could not check the price right now.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      const out = d?.verdict === "unknown" ? null : checkAdvert(asking, { low: d.low, mid: d.mid, high: d.high });
      if (!out) { setNoData(true); return; }
      if (!user && typeof d?.checkId === "string") rememberGuestCheck(d.checkId);
      setRes({ ...out, asking, sample: d.sample, basis: d.basis, source: d.source, checkId: typeof d?.checkId === "string" ? d.checkId : null, car: { make: f.make.trim(), model: f.model.trim(), year: Number(f.year) || null } });
      try { posthog.capture?.("advert_check", { verdict: out.verdict, has_link: !!f.link }); } catch { /* optional */ }
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`c-${k}`}>{label}</Label>
      <Input id={`c-${k}`} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} className="h-11" {...props} />
    </div>
  );

  const V = res ? VERDICT[res.verdict] : null;
  const scaleMin = res ? Math.min(res.privateLow, res.asking) * 0.95 : 0;
  const scaleMax = res ? Math.max(res.retailHigh, res.asking) * 1.05 : 1;
  const pos = (n: number) => `${Math.min(100, Math.max(0, ((n - scaleMin) / (scaleMax - scaleMin)) * 100))}%`;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-2xl py-8 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <SearchCheck className="h-7 w-7 text-primary shrink-0" aria-hidden /> Is this used car a fair price?
        </h1>
        {!user && <div className="mt-6"><AdvertFollowupCard guest /></div>}
        <p className="text-sm text-muted-foreground mt-2">Buying a used car? Copy in the details from any UK car advert and we'll tell you how the asking price compares with what similar cars go for in the UK.</p>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 mt-6">
          {field("make", "Make", { placeholder: "e.g. Skoda", autoComplete: "off", required: true })}
          {field("model", "Model", { placeholder: "e.g. Octavia", autoComplete: "off", required: true })}
          {field("year", "Year", { inputMode: "numeric", placeholder: "e.g. 2019", required: true })}
          {field("mileage", "Mileage", { inputMode: "numeric", placeholder: "e.g. 45,000", required: true })}
          <div className="sm:col-span-2">{field("askingPrice", "Asking price (£)", { inputMode: "numeric", placeholder: "e.g. 12,995", required: true })}</div>
          <div className="sm:col-span-2">{field("link", "Advert link (optional)", { type: "url", placeholder: "https://…", autoComplete: "off" })}</div>
          <fieldset className="sm:col-span-2 space-y-1.5">
            <legend className="text-sm font-medium leading-none mb-1.5">Who's selling? <span className="text-muted-foreground font-normal">(optional)</span></legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {SELLERS.map((o) => (
                <Button key={o.v} type="button" role="radio" aria-checked={f.sellerType === o.v} size="sm"
                  variant={f.sellerType === o.v ? "default" : "outline"} className="min-h-[44px]"
                  onClick={() => setF((s) => ({ ...s, sellerType: s.sellerType === o.v ? "" : o.v }))}>{o.label}</Button>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <Button type="submit" variant="hero" size="lg" disabled={busy} className="w-full sm:w-auto min-h-[48px]">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…</> : <>Check this advert <ArrowRight className="h-4 w-4" aria-hidden /></>}
            </Button>
            {!user && <p className="text-xs text-muted-foreground mt-2">Free, no account needed.</p>}
          </div>
        </form>

        {guestLimit && !user && (
          <section role="alert" className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="font-semibold">You've used today's free guest checks</p>
            <p className="text-sm text-muted-foreground mt-1">{guestLimit}</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Button asChild variant="hero" size="sm" className="min-h-[44px]"><Link to="/auth?mode=signup">Create a free account</Link></Button>
              <Button asChild variant="ghost" size="sm" className="min-h-[44px]"><Link to="/auth">I already have one</Link></Button>
            </div>
          </section>
        )}

        {noData && (
          <section className="mt-8 rounded-xl border border-border bg-card/60 p-5" aria-live="polite">
            <p className="font-semibold">Not enough market data</p>
            <p className="text-sm text-muted-foreground mt-1">We couldn't find enough comparable cars to judge this one fairly. Try a broader model name (e.g. "Golf" rather than "Golf GTI Clubsport").</p>
          </section>
        )}

        {res && V && (
          <section className={`mt-8 rounded-2xl border p-5 sm:p-6 ${V.ring}`} aria-live="polite">
            <div className="flex items-center gap-3">
              <V.icon className={`h-7 w-7 ${V.cls}`} aria-hidden />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Verdict</p>
                <p className={`text-2xl font-semibold ${V.cls}`}>{V.label}</p>
                {res.source !== "marketcheck" && (
                  <span className="inline-block mt-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Estimate</span>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">{V.tip}</p>
            <p className="text-sm mt-3">Asking <strong>{gbp(res.asking)}</strong> is {Math.abs(res.vsRetailPct)}% {res.vsRetailPct >= 0 ? "above" : "below"} the typical dealer asking price.</p>

            <div className="relative h-2 rounded-full bg-muted mt-6 mb-8" aria-hidden>
              <div className="absolute h-2 rounded-full bg-emerald-400/50" style={{ left: pos(res.privateLow), width: `calc(${pos(res.privateHigh)} - ${pos(res.privateLow)})` }} />
              <div className="absolute h-2 rounded-full bg-primary/50" style={{ left: pos(res.retailLow), width: `calc(${pos(res.retailHigh)} - ${pos(res.retailLow)})` }} />
              <div className="absolute -top-1.5 h-5 w-1 rounded bg-foreground" style={{ left: pos(res.asking) }} />
              <span className="absolute top-4 text-xs -translate-x-1/2 whitespace-nowrap" style={{ left: pos(res.asking) }}>Asking</span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">Private sale range</dt>
                <dd className="font-semibold tabular-nums mt-1">{gbp(res.privateLow)} – {gbp(res.privateHigh)}</dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">Dealer retail range</dt>
                <dd className="font-semibold tabular-nums mt-1">{gbp(res.retailLow)} – {gbp(res.retailHigh)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground mt-3">{res.source === "marketcheck"
              ? <>Based on {res.sample} comparable listings ({res.basis}), mileage-adjusted.</>
              : res.source === "ai_estimate"
                ? <>Estimate: AI market estimate, not live listings — treat as a guide only.</>
                : <>Estimate from {res.basis}, not live listings.</>} Private range is estimated from dealer asking prices. Doesn't account for this car's condition, spec or history.</p>
            <CheckOutcomePrompt checkId={res.checkId} signedIn={!!user} />
            <div className="mt-5">
              <p className="text-sm font-medium mb-2">Share this check</p>
              <ShareButtons
                campaign="check_result"
                make={res.car.make}
                model={res.car.model}
                text={`Valu8 says this ${res.car.year ? `${res.car.year} ` : ""}${res.car.make} ${res.car.model} is ${V.label.toLowerCase()}: private sale range ${gbp(res.privateLow)}–${gbp(res.privateHigh)}. Check any used car advert free:`}
              />
            </div>
            {!user && <div className="mt-5"><GuestMarketingConsent /></div>}
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <Button asChild variant="outline" className="min-h-[44px]"><Link to="/valuation/new">Get a full report with MOT history</Link></Button>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => { setRes(null); setF(EMPTY); }}>Check another advert</Button>
            </div>
          </section>
        )}

        <div className="mt-8"><AccuracyDisclaimer /></div>
      </main>
      <Footer />
    </div>
  );
}
