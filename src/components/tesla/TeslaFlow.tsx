import "@/styles/plate.css";
import "@/styles/tesla.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { posthog } from "@/lib/posthog";
import { isFoundVehicle, isPlausibleUkReg, normaliseReg } from "@/lib/registration";
import { Turnstile, turnstileEnabled, turnstileHeaders } from "@/components/Turnstile";
import { getAttribution } from "@/lib/attribution";
import { getUtm, track } from "@/lib/funnel";
import { inferPerformanceTrim, type TrimHint } from "@/lib/perfTrim";
import { quickReportFrom, shownBand } from "@/lib/quickEstimate";
import { functionErrorBody, getGuestToken, photoToDataUrl, rememberGuestValuation } from "@/lib/guest";
import { PHOTO_SLOTS, fillEmptySlots, type PhotoSlotKey } from "@/lib/cars";
import { normaliseReportPricing } from "@/lib/askingPrice";
import { reportPriceRange, rangeReasonCopy } from "../../../supabase/functions/_shared/cheapRange";
import { ElementsCheckout } from "@/components/ReportCheckout";
import { CheckoutSheet } from "./CheckoutSheet";
import { closeKeyboard, scrollPageTop } from "@/lib/scrollTop";
import { HOME_EVENT, depthOf, popAction, pushFor, readFlowSnapshot, saveFlowSnapshot, viewOf, type FlowView } from "@/lib/flowHistory";
import { LOCKED_ROWS, PREMIUM_CTA, PREMIUM_NAME, PREMIUM_TITLE, includesFor, includesLine } from "./premium";
import { IntentSwitch } from "@/components/IntentSwitch";
import { getIntent, saveAskingFor, saveIntentFor, useIntent } from "@/lib/intent";
import { parseAsking } from "@/lib/buyerGuide";
import { bodyKeyFor, carImageSrc, type BodyKey } from "./carImage";
import { renderFor } from "./modelRenders";
import { mileageHint } from "@/lib/mileageHint";
import { gradeArc, gradeFromReport, type CarGrade } from "@/lib/carGrade";
import { PriceArc, RingLoader, RollingPrice, useEasedProgress } from "./parts";
import { FitPrice } from "@/components/FitPrice";

interface Lookup {
  registration: string; make?: string; model?: string; variant?: string; year?: number; fuelType?: string; transmission?: string; transmissionGuess?: Gearbox;
  colour?: string; firstRegistered?: string; manufactureYear?: number; engineCapacity?: number; bodyStyle?: string; doors?: number;
  co2Emissions?: number; motExpiry?: string; lastMileage?: number; lastMileageDate?: string; motTestCount?: number; recentAdvisories?: string[];
}
type Gearbox = "Automatic" | "Manual";
/** Provider gearbox text -> chip value ("Semi-Auto", "DSG", "CVT" count as automatic). */
const gearboxOf = (t?: string): Gearbox | "" => (/auto|semi|dsg|cvt|tiptronic|steptronic|tronic|pdk|dct/i.test(t ?? "") ? "Automatic" : /manual/i.test(t ?? "") ? "Manual" : "");
interface Photo { key: PhotoSlotKey; file: File; preview: string }
type Stage = "idle" | "looking" | "estimating" | "estimate" | "refining" | "refined";
interface Band { low: number; high: number; single: boolean; why?: string }

const SHORT_SLOT: Record<string, string> = { front: "Front 3/4 angle", rear: "Rear 3/4 angle", side: "Driver's side", interior: "Interior", odometer: "Odometer", engine: "Engine bay" };
const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
const fmtReg = (r: string) => { const s = r.replace(/\s+/g, "").toUpperCase(); return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4)}` : s; };
const titleCase = (s?: string) => (s ?? "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Display band for a stored report, by the site's display rules (range under £5k or 16y+, single figure otherwise). */
function bandFor(report: any): Band | null {
  if (!report || report.valuationUnavailable) return null;
  const p = normaliseReportPricing(report).privateSale;
  if (!(p > 0)) return null;
  const r = reportPriceRange(report, p);
  return r ? { low: r.low, high: r.high, single: false, why: rangeReasonCopy(r) } : { low: p, high: p, single: true };
}
const bandText = (b: Band) => (b.single ? gbp(b.low) : `${gbp(b.low)}–${gbp(b.high)}`);

const waitFor = (get: () => string | null, ms: number) => new Promise<string | null>((resolve) => {
  const t0 = Date.now();
  const tick = () => { const v = get(); if (v || Date.now() - t0 > ms) resolve(v); else setTimeout(tick, 150); };
  tick();
});

export function TeslaFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [reg, setReg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [guestLimit, setGuestLimit] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [variant, setVariant] = useState("");
  const [trimHint, setTrimHint] = useState<TrimHint | null>(null);
  const [trimAuto, setTrimAuto] = useState(false);
  const [mileage, setMileage] = useState("");
  const [gearbox, setGearbox] = useState<Gearbox | "">("");
  const [gearboxGuessed, setGearboxGuessed] = useState(false);
  const [mods, setMods] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [valuationId, setValuationId] = useState<string | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  // Price-first: early estimate shown while the full report loads. Display-only; never feeds canPay, snapshots or saves.
  const [quickBand, setQuickBand] = useState<Band | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [grade, setGrade] = useState<CarGrade | null>(null);
  const [refineDone, setRefineDone] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  /** Premium path: the visitor tapped Premium Report on the landing page, so the details step shows one Pay button. */
  const [premiumBusy, setPremiumBusy] = useState(false);
  /** Homepage "Unlock Premium Report" with no car yet: the reg card is armed for the premium path. */
  const [premiumArmed, setPremiumArmed] = useState(false);
  /** Guest past today's free cap who chose Premium: the valuation exists but its price stays hidden until paid. */
  const [locked, setLocked] = useState(false);
  /** Which daily limit stopped the last valuation: the free one (Premium still open) or the guest premium one. */
  const [limitKind, setLimitKind] = useState<"free" | "premium">("free");
  /** A failure starting the premium checkout, shown by the Pay button with a retry. */
  const [payErr, setPayErr] = useState<string | null>(null);
  /** The loader fades out before it unmounts, so it never cuts away mid-fade over the buttons. */
  const [loaderOut, setLoaderOut] = useState(false);
  const [nudgePay, setNudgePay] = useState(false);
  const payRef = useRef<HTMLDivElement>(null);
  /** Details the locked valuation was made with; paying again with the same details skips re-valuing. */
  const lockedSig = useRef<string | null>(null);
  const [needMileage, setNeedMileage] = useState(false);
  /** Buying or Selling (shared with the homepage selector, the result card and the checkout). */
  const [intent] = useIntent();
  /** Optional advertised asking price, buyers only. Compared with the valuation in the paid report. */
  const [asking, setAsking] = useState("");
  const regInput = useRef<HTMLInputElement>(null);
  const tsRef = useRef<string | null>(null);
  const [tsKey, setTsKey] = useState(0);
  const [tsOn, setTsOn] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const unlockRef = useRef<HTMLDivElement>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);
  const slotTarget = useRef<PhotoSlotKey | null>(null);
  /** Bumped by Back and by a reset, so a lookup or valuation still in flight never pulls the flow forward again. */
  const epoch = useRef(0);
  /** A result has been shown for this car (Back to details, then Forward, can show it again). */
  const refinedOnce = useRef(false);
  /** Closes the checkout sheet with its slide-out (set while the sheet is open). */
  const sheetCloseRef = useRef<(() => void) | null>(null);

  const bodyKey: BodyKey = useMemo(() => (lookup ? bodyKeyFor(lookup) : "hatchback"), [lookup]);
  // The exact model and generation when we have a render for it, else the body-type render.
  const carSrc = useMemo(() => (lookup && renderFor(lookup)) || carImageSrc(bodyKey), [lookup, bodyKey]);
  const progress = useEasedProgress(stage === "refining", refineDone, photos.length ? 30000 : 20000);

  const onToken = useCallback((t: string | null) => { tsRef.current = t; }, []);
  async function freshToken(): Promise<string | null> {
    if (!turnstileEnabled()) return null;
    setTsOn(true);
    return waitFor(() => tsRef.current, 12000);
  }
  const spendToken = () => { tsRef.current = null; setTsKey((k) => k + 1); };

  useEffect(() => { if (valuationId) saveIntentFor(valuationId, intent); }, [valuationId, intent]);
  useEffect(() => { if (valuationId && intent === "buying") saveAskingFor(valuationId, parseAsking(asking)); }, [valuationId, intent, asking]);

  // Homepage section buttons. Premium: open the checkout when a valuation is ready, glide to the Pay button
  // when the details step is open, else glide to the reg card with Premium selected. Otherwise back to the reg card.
  const flowRef = useRef({ stage, valuationId, hasCar: false, canPay: false });
  useEffect(() => {
    const go = (e: Event) => {
      const premium = !!(e as CustomEvent<{ premium?: boolean }>).detail?.premium;
      const f = flowRef.current;
      if (premium && f.stage === "refined" && f.valuationId && f.canPay) {
        track("offer_click", "premium_section"); posthog.capture?.("Premium Report Click", { where: "section" });
        setCheckoutOpen(true);
        return;
      }
      if (premium && f.hasCar && f.stage !== "refined") {
        setPremiumBusy(true); setPayErr(null);
        setTimeout(() => {
          payRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          setNudgePay(true); setTimeout(() => setNudgePay(false), 1800);
        }, 30);
        return;
      }
      if (premium && !f.hasCar) setPremiumArmed(true);
      const target: HTMLElement | null = (!premium && unlockRef.current) || (f.hasCar ? detailsRef.current : null) || topRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!f.hasCar) setTimeout(() => regInput.current?.focus({ preventScroll: true }), 650);
    };
    window.addEventListener("valu8:reg", go);
    return () => window.removeEventListener("valu8:reg", go);
  }, []);

  // ?reg=AB12CDE on the homepage starts the check once (embeds and share links).
  const [params, setParams] = useSearchParams();
  const regHandled = useRef(false);
  useEffect(() => {
    const raw = params.get("reg");
    if (!raw || regHandled.current) return;
    regHandled.current = true;
    const next = new URLSearchParams(params); next.delete("reg"); setParams(next, { replace: true });
    const c = normaliseReg(raw);
    if (c) { setReg(c); if (isPlausibleUkReg(c)) setTimeout(() => void start(c), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function analyseBody(l: Lookup, extra: { mileage: number; variant: string; transmission?: Gearbox | ""; mods?: string; notes?: string; photoUrls?: string[]; photosLabeled?: { slot: string; url: string }[]; guestPhotos?: { slot: string; dataUrl: string }[]; refineOf?: string | null; premiumIntent?: boolean }) {
    const combined = [extra.notes?.trim() ?? "", extra.mods?.trim() ? `Modifications / extras: ${extra.mods.trim()}` : ""].filter(Boolean).join("\n");
    const transmission = extra.transmission || l.transmission || undefined;
    const vehicle = { fuelType: l.fuelType, transmission, firstRegistered: l.firstRegistered, engineCapacity: l.engineCapacity, co2Emissions: l.co2Emissions };
    return {
      combined, vehicle,
      body: {
        make: l.make, model: l.model, variant: extra.variant.trim() || undefined, year: l.year, mileage: extra.mileage,
        registration: l.registration || undefined, motExpiry: l.motExpiry || undefined,
        serviceNotes: extra.notes?.trim() || undefined, modifications: extra.mods?.trim() || undefined,
        colour: l.colour || undefined, fuelType: l.fuelType || undefined, transmission,
        engineCapacity: l.engineCapacity || undefined, bodyStyle: l.bodyStyle || undefined, firstRegistered: l.firstRegistered || undefined,
        manufactureYear: l.manufactureYear || undefined, motAdvisories: l.recentAdvisories?.length ? l.recentAdvisories : undefined,
        photoUrls: extra.photoUrls ?? [], photos: extra.photosLabeled ?? [],
        ...(user ? { userId: user.id } : {
          guestToken: getGuestToken(), guestPhotos: extra.guestPhotos ?? [],
          ...(extra.refineOf ? { refineOf: extra.refineOf } : {}),
          ...(extra.premiumIntent ? { premiumIntent: true } : {}),
          guestSave: {
            displayModel: extra.variant.trim() ? `${l.model} · ${extra.variant.trim()}` : l.model,
            serviceNotes: combined || null, vehicle, attribution: getAttribution() ?? null, utm: getUtm(),
          },
        }),
      },
    };
  }

  /** Runs analyse-vehicle (the existing engine, unchanged) and saves the valuation. Returns id + report, or null on a handled error. */
  async function value(l: Lookup, extra: Parameters<typeof analyseBody>[1], existingId: string | null) {
    const token = await freshToken();
    const { body, combined, vehicle } = analyseBody(l, extra);
    const { data, error } = await supabase.functions.invoke("analyse-vehicle", { body, headers: turnstileHeaders(token) });
    spendToken();
    if (error) {
      const { status, body: eb } = await functionErrorBody(error);
      if (!user && status === 429 && eb?.code === "guest_limit") {
        posthog.capture?.("Guest Limit Reached", { premium: !!extra.premiumIntent });
        setGuestLimit(eb.error);
        setLimitKind(extra.premiumIntent ? "premium" : "free");
        // Free valuations are used up for today, but the paid report is still open: switch to the one Pay button.
        if (!extra.premiumIntent) setPremiumBusy(true);
        return null;
      }
      if (!user && status === 401) { navigate(`/valuation/new?reg=${encodeURIComponent(l.registration)}&manual=1`); return null; }
      throw new Error(eb?.error || "We couldn't value this car just now. Please try again.");
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    if (!user && (data as any)?.locked === true) {
      const id = (data as any)?.valuationId as string | undefined;
      if (!id) throw new Error("We couldn't save your valuation. Please try again.");
      rememberGuestValuation(id);
      return { id, report: null, locked: true as const, priceable: (data as any)?.priceable !== false };
    }
    const report = (data as any)?.report;
    if (!report) throw new Error("We couldn't value this car just now. Please try again.");
    if (!user) {
      const id = (data as any)?.valuationId as string | undefined;
      if (!id) throw new Error("We couldn't save your valuation. Please try again.");
      rememberGuestValuation(id);
      return { id, report, locked: false as const, priceable: !!bandFor(report) };
    }
    report.vehicle = vehicle;
    const row = {
      make: l.make!, model: extra.variant.trim() ? `${l.model} · ${extra.variant.trim()}` : l.model!, year: l.year!, mileage: extra.mileage,
      registration: l.registration || null, mot_expiry: l.motExpiry || null, service_notes: combined || null,
      photo_urls: extra.photoUrls ?? [], condition_score: report.conditionScore,
      private_value: report.valuationUnavailable ? null : report.values.privateSale,
      report: { ...report, ...(getAttribution() ? { attribution: getAttribution() } : {}) } as any,
    };
    if (existingId) {
      const { error: uErr } = await supabase.from("valuations").update(row).eq("id", existingId);
      if (!uErr) return { id: existingId, report, locked: false as const, priceable: !!bandFor(report) };
    }
    const { data: ins, error: iErr } = await supabase.from("valuations").insert({ user_id: user.id, ...row, ...getUtm() }).select("id").single();
    if (iErr) throw iErr;
    return { id: ins.id as string, report, locked: false as const, priceable: !!bandFor(report) };
  }

  /** Premium Report buttons: open the existing £2.99 checkout once the valuation is saved (only when we could price the car). */
  function openPremium(where: "details" | "premium_path", report: any, delay: number) {
    if (report !== null && !bandFor(report)) { setPayErr(UNPRICEABLE); return; }
    track("offer_click", `premium_${where}`);
    posthog.capture?.("Premium Report Click", { where });
    setTimeout(() => setCheckoutOpen(true), delay);
  }

  const quickDone = useRef(0);
  async function runQuick(l: Lookup, extra: Parameters<typeof analyseBody>[1], e0: number) {
    try {
      const { body } = analyseBody(l, extra);
      const { data, error } = await supabase.functions.invoke("analyse-vehicle", { body: { ...body, quick: true } });
      if (error) return;
      const report = quickReportFrom(data);
      if (!report) return;
      // Late answers are dropped: wrong search, or the full result already landed.
      if (epoch.current !== e0 || quickDone.current === e0) return;
      const b = bandFor(report);
      if (b) setQuickBand(b);
    } catch { /* fall back to the full result */ }
  }

  async function start(raw?: string, premium = false) {
    const cleaned = normaliseReg(raw ?? reg);
    if (!isPlausibleUkReg(cleaned)) { setErr("Enter a valid UK number plate, e.g. AB12 CDE."); return; }
    closeKeyboard();
    setPremiumBusy(premium); setPremiumArmed(false); setLocked(false); setPayErr(null); setUnavailable(false);
    setErr(null); setGuestLimit(null); setStage("looking"); setBand(null); setQuickBand(null); setValuationId(null); setGrade(null); setNeedMileage(false);
    if (turnstileEnabled()) setTsOn(true);
    const e0 = ++epoch.current;
    let l: Lookup;
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vehicle", { body: { registration: cleaned, ...(premium ? { premiumIntent: true } : {}) } });
      if (error) {
        const { status, body } = await functionErrorBody(error);
        if (status === 401 && !user) { navigate(`/valuation/new?reg=${encodeURIComponent(cleaned)}&manual=1`); return; }
        if (status === 429 && body?.code === "guest_limit") { setGuestLimit(body.error); setStage("idle"); return; }
        if (body?.code === "lookup_unavailable") throw new Error("Our vehicle lookup is busy right now. Try again in a few minutes, or enter the details by hand.");
        throw new Error(body?.error || "We couldn't find a car with that registration.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      if (epoch.current !== e0) return;
      l = data as Lookup;
      if (!isFoundVehicle(l)) throw new Error("We couldn't find a car with that registration.");
    } catch (e: any) {
      if (epoch.current !== e0) return;
      track("lookup_fail");
      const m = String(e?.message || "We couldn't find a car with that registration.").trim();
      setErr(/[.!?]$/.test(m) ? m : `${m}.`);
      setStage("idle");
      return;
    }
    track("lookup_success");
    track("step_details");
    setLookup(l);
    const providerTrim = (l.variant ?? "").trim();
    const hint = providerTrim ? null : inferPerformanceTrim({ make: l.make, model: l.model, fuel: l.fuelType, cc: l.engineCapacity, year: l.year, gearbox: l.transmission });
    const v = providerTrim || (hint?.confident ? hint.variant : "");
    setTrimHint(hint); setVariant(v); setTrimAuto(!providerTrim && !!hint?.confident);
    setMileage(l.lastMileage ? String(l.lastMileage) : "");
    // gb-1: DVSA has no gearbox; pre-set the chip from the record, else the likely gearbox for this model.
    const gbRecord = gearboxOf(l.transmission);
    const gb: Gearbox | "" = gbRecord || l.transmissionGuess || "";
    setGearbox(gb); setGearboxGuessed(!gbRecord && !!gb);
    if (!l.lastMileage || !l.make || !l.model || !l.year) {
      // No MOT mileage yet (newer cars): ask for it rather than guess.
      setNeedMileage(true); setStage("estimate");
      return;
    }
    setStage("estimating");
    track("submitted");
    // Price-first: ask for the early estimate in parallel with the full report. If it fails, is slow or isn't
    // offered, nothing changes: the full call below behaves exactly as before.
    if (!premium) void runQuick(l, { mileage: l.lastMileage, variant: v, transmission: gb }, e0);
    try {
      const res = await value(l, { mileage: l.lastMileage, variant: v, transmission: gb, premiumIntent: premium }, null);
      if (epoch.current !== e0) return;
      quickDone.current = e0;
      if (!res) {
        // Daily free limit: the details step now offers the paid report (one Pay button). The page is already at the top.
        setStage("estimate");
        return;
      }
      if (res.locked) applyLocked(res.id, res.priceable);
      else applyResult(res.id, res.report, true, l.lastMileage, l);
      setStage("estimate");
      // Premium path: no checkout yet. The car lands at the top of the page; the details step (one Pay button) is just below.
    } catch (e: any) {
      if (epoch.current !== e0) return;
      setErr(e?.message || "We couldn't value this car just now. Please try again.");
      setStage("estimate");
    }
  }

  function applyResult(id: string, report: any, first: boolean, miles: number | undefined, car: Lookup) {
    setValuationId(id);
    const b = bandFor(report);
    setUnavailable(!b);
    if (b) {
      setBand(b);
      setGrade(gradeFromReport(report, { mileage: miles, firstRegistered: car.firstRegistered, year: car.year }));
    } else setGrade(null);
    track("result_seen");
    track("valuation_completed");
    posthog.capture?.("Valuation Report Generated", { valuation_id: id, guest: !user, home_flow: true, refined: !first, private_value: report?.values?.privateSale, valuation_unavailable: !!report?.valuationUnavailable });
  }

  /** Price-locked valuation (guest past the free cap, Premium chosen): no price on screen until paid. */
  function applyLocked(id: string, priceable: boolean) {
    setValuationId(id); setLocked(true); setBand(null); setGrade(null); setUnavailable(!priceable);
    track("valuation_completed");
    posthog.capture?.("Valuation Report Generated", { valuation_id: id, guest: true, home_flow: true, price_locked: true, valuation_unavailable: !priceable });
  }

  /** Fades the loader out (after a short minimum so it never flashes), then runs `next`. */
  function closeLoader(t0: number, next: () => void, minMs = 300) {
    const wait = Math.max(0, minMs - (Date.now() - t0));
    setTimeout(() => {
      setLoaderOut(true);
      setTimeout(() => { setLoaderOut(false); next(); }, 380);
    }, wait);
  }

  const detailSig = () => JSON.stringify([mileage, variant, gearbox, mods, notes, photos.map((p) => p.preview)]);

  async function refine(e?: React.FormEvent, premium = false) {
    e?.preventDefault();
    if (!lookup) return;
    // Locked valuation already made with these details: go straight to the checkout.
    if (premium && locked && valuationId && !unavailable && lockedSig.current === detailSig()) {
      setPayErr(null); track("offer_click", "premium_premium_path"); setCheckoutOpen(true); return;
    }
    const miles = Number(mileage.replace(/[,\s]/g, ""));
    if (!Number.isFinite(miles) || miles < 0 || miles > 500000 || mileage.trim() === "") { setErr("Enter the current mileage."); return; }
    closeKeyboard();
    setErr(null); setPayErr(null); setGuestLimit(null); setRefineDone(false); setLoaderOut(false); setStage("refining");
    track("submitted");
    if (photos.length) track("step_photos");
    const t0 = Date.now();
    const e0 = ++epoch.current;
    const live = () => epoch.current === e0;
    try {
      const photoUrls: string[] = []; const labeled: { slot: string; url: string }[] = []; const guestPhotos: { slot: string; dataUrl: string }[] = [];
      for (const p of photos) {
        if (!user) { const d = await photoToDataUrl(p.file); if (d) guestPhotos.push({ slot: p.key, dataUrl: d }); continue; }
        const ext = p.file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (error) throw error;
        photoUrls.push(path); labeled.push({ slot: p.key, url: path });
      }
      const res = await value(lookup, { mileage: miles, variant, transmission: gearbox, mods, notes, photoUrls, photosLabeled: labeled, guestPhotos, refineOf: valuationId, premiumIntent: premium }, valuationId);
      if (!live()) return;
      if (!res) {
        // Daily limit: fade the loader away, then show the notice by the buttons.
        closeLoader(t0, () => { setStage("estimate"); setTimeout(() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); });
        return;
      }
      if (res.locked) {
        // Price stays hidden until paid: finish the ring, then hand straight over to the checkout.
        applyLocked(res.id, res.priceable);
        lockedSig.current = detailSig();
        const wait = 0; // no padding: the ring completes as soon as the result is in
        setRefineDone(true);
        setTimeout(() => {
          if (!live()) return;
          if (!res.priceable) { closeLoader(0, () => { setStage("estimate"); setPayErr(UNPRICEABLE); }); return; }
          track("offer_click", "premium_premium_path"); posthog.capture?.("Premium Report Click", { where: "locked" });
          setCheckoutOpen(true);
          closeLoader(0, () => setStage("estimate"));
        }, wait + 300);
        return;
      }
      // Let the ring finish cleanly before revealing the result.
      const wait = 0; // no padding: the ring completes as soon as the result is in
      setRefineDone(true);
      setTimeout(() => {
        if (!live()) return;
        applyResult(res.id, res.report, !band, miles, lookup);
        setStage("refined");
        // Under the loader's last frame: the result opens at the top with no visible jump.
        scrollPageTop({ instant: true });
        if (premium) openPremium(premiumBusy ? "premium_path" : "details", res.report, 700);
      }, wait + 400);
    } catch (e2: any) {
      if (!live()) return;
      const m = e2?.message || "We couldn't update the valuation. Please try again.";
      closeLoader(t0, () => { setStage("estimate"); if (premium) setPayErr(m); else setErr(m); });
    }
  }

  // offer_view once when the unlock card is on screen.
  useEffect(() => {
    if (stage !== "refined" || !unlockRef.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => { if (en?.isIntersecting) { track("offer_view"); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(unlockRef.current);
    return () => io.disconnect();
  }, [stage]);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; const k = slotTarget.current;
    e.target.value = "";
    if (!f || !f.type.startsWith("image/") || !k) return;
    setPhotos((ps) => [...ps.filter((p) => p.key !== k), { key: k, file: f, preview: URL.createObjectURL(f) }]);
  }

  function pickBulk(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    setPhotos((ps) => [...ps, ...fillEmptySlots(ps.map((p) => p.key), files).map(({ key, file }) => ({ key, file, preview: URL.createObjectURL(file) }))]);
  }

  function reset() {
    setStage("idle"); setLookup(null); setBand(null); setQuickBand(null); setValuationId(null); setGrade(null); setErr(null); setGuestLimit(null);
    setPhotos([]); setMods(""); setNotes(""); setReg(""); setCheckoutOpen(false); setPremiumBusy(false); setGearbox(""); setGearboxGuessed(false);
    setPremiumArmed(false); setLocked(false); setPayErr(null); setLimitKind("free"); setUnavailable(false);
    epoch.current++; refinedOnce.current = false; sheetCloseRef.current = null; saveFlowSnapshot(null);
    // Unwind the flow's history entries, so Back from the fresh start leaves the flow rather than replaying it.
    const d = depthOf(locRef.current.state);
    if (d > 0) navigate(-d);
    scrollPageTop();
  }

  const busyLookup = stage === "looking" || stage === "estimating";
  const hasCar = !!lookup && stage !== "idle" && stage !== "looking";
  const shown = shownBand(band, quickBand, stage);
  const fr = band && grade ? gradeArc(grade.index) : null;
  const name = lookup ? [lookup.year, titleCase(lookup.make), titleCase(lookup.model), variant && !(lookup.model ?? "").toLowerCase().includes(variant.toLowerCase()) ? (variant.toLowerCase().startsWith(`${(lookup.model ?? "").toLowerCase().split(" ")[0]} `) ? variant.slice((lookup.model ?? "").split(" ")[0].length).trim() : variant) : ""].filter(Boolean).join(" ") : "";
  const facts = lookup ? [lookup.engineCapacity ? `${lookup.engineCapacity.toLocaleString("en-GB")} cc` : "", titleCase(lookup.fuelType), titleCase(lookup.colour)].filter(Boolean).join(" · ") : "";
  const refined = stage === "refined";
  const milesNum = Number(mileage.replace(/[,\s]/g, ""));
  flowRef.current = { stage, valuationId, hasCar, canPay: !!band };

  // Whenever the flow moves to a new view (reg card -> car and details, details -> result, back to a new plate),
  // bring the visitor back to the top so they see the change. The result view handles its own instant scroll.
  const view = !hasCar ? "entry" : refined ? "result" : "details";
  const lastView = useRef(view);
  useEffect(() => {
    if (lastView.current === view) return;
    const from = lastView.current; lastView.current = view;
    if (view === "details" && from === "entry") scrollPageTop();
  }, [view]);

  // Browser history. Each forward step (car and details, result, checkout) is one history entry on the same URL,
  // so the phone's Back button walks back through the flow before it leaves the site. Loader stages never push.
  const location = useLocation();
  const navType = useNavigationType();
  const locRef = useRef(location);
  locRef.current = location;
  if (refined) refinedOnce.current = true;
  const flowView: FlowView = checkoutOpen && valuationId ? "checkout" : view;
  const here = () => ({ pathname: locRef.current.pathname, search: locRef.current.search });

  useEffect(() => {
    const st = pushFor(locRef.current.state, flowView);
    if (st) navigate(here(), { state: st });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowView]);

  /** Back (or Forward) landed on a flow entry: show that step, keeping what the visitor entered. */
  function applyHistory(target: FlowView) {
    const a = popAction(target, {
      view: flowView, hasLookup: !!lookup, hasResult: refinedOnce.current && !!valuationId && !!band,
      canCheckout: !!valuationId && !unavailable && (refinedOnce.current || locked),
    });
    if (a.kind === "none") return;
    if (a.kind === "replace") { navigate(here(), { replace: true, state: { ...(locRef.current.state as object | null ?? {}), v8: a.view } }); return; }
    if (a.kind === "openCheckout") { setCheckoutOpen(true); return; }
    if (a.kind === "closeCheckout" || (a.kind === "show" && a.closeCheckout)) {
      if (sheetCloseRef.current) sheetCloseRef.current(); else setCheckoutOpen(false);
      if (a.kind === "closeCheckout") return;
    }
    if (a.kind !== "show") return;
    epoch.current++;
    closeKeyboard();
    setErr(null); setPayErr(null); setLoaderOut(false);
    if (a.view === "entry") {
      // Back on the reg card with the plate still in the box.
      setStage("idle"); setGuestLimit(null); setPremiumArmed(false);
      if (lookup?.registration) setReg(fmtReg(lookup.registration));
    } else if (a.view === "details") setStage("estimate");
    else setStage("refined");
    scrollPageTop();
  }

  const lastKey = useRef(location.key);
  useEffect(() => {
    if (lastKey.current === location.key) return;
    lastKey.current = location.key;
    if (navType === "POP") applyHistory(viewOf(location.state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Coming Back from the report page, or reloading mid-flow: restore the step from this tab's snapshot.
  useEffect(() => {
    const target = viewOf(locRef.current.state);
    if (target === "entry") return;
    const snap = readFlowSnapshot<any>();
    if (!snap?.lookup) { navigate(here(), { replace: true, state: { ...(locRef.current.state as object | null ?? {}), v8: "entry" } }); return; }
    setLookup(snap.lookup); setReg(snap.reg ?? ""); setVariant(snap.variant ?? ""); setMileage(snap.mileage ?? "");
    setGearbox(snap.gearbox ?? ""); setMods(snap.mods ?? ""); setNotes(snap.notes ?? "");
    setValuationId(snap.valuationId ?? null); setBand(snap.band ?? null); setGrade(snap.grade ?? null);
    setUnavailable(!!snap.unavailable); setLocked(!!snap.locked); setPremiumBusy(!!snap.premiumBusy); setNeedMileage(!!snap.needMileage);
    refinedOnce.current = !!(snap.refined && snap.valuationId && snap.band);
    const show: FlowView = target !== "details" && refinedOnce.current ? "result" : "details";
    setStage(show === "result" ? "refined" : "estimate");
    if (show !== target) navigate(here(), { replace: true, state: { ...(locRef.current.state as object | null ?? {}), v8: show } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lookup || view === "entry") return;
    saveFlowSnapshot({ reg, lookup, variant, mileage, gearbox, mods, notes, valuationId, band, grade, unavailable, locked, premiumBusy, needMileage, refined: refinedOnce.current });
  }, [view, reg, lookup, variant, mileage, gearbox, mods, notes, valuationId, band, grade, unavailable, locked, premiumBusy, needMileage]);

  // The Valu8 logo and "Value a car" on the homepage: back to the start of the flow.
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    const home = (e: Event) => {
      const focus = !!(e as CustomEvent<{ focusReg?: boolean }>).detail?.focusReg;
      resetRef.current();
      if (focus) setTimeout(() => regInput.current?.focus({ preventScroll: true }), 650);
    };
    window.addEventListener(HOME_EVENT, home);
    return () => window.removeEventListener(HOME_EVENT, home);
  }, []);

  /** On-screen Back: one step back through the flow (the same as the phone's Back button). */
  function goBack() {
    if (depthOf(locRef.current.state) > 0) navigate(-1);
    else if (flowView === "result") applyHistory("details");
    else reset();
  }

  return (
    <div className="t8" ref={topRef}>
      <div className="t8-bgglow" aria-hidden />
      {turnstileEnabled() && tsOn && <div style={{ position: "absolute", left: 0, bottom: 0, zIndex: 5 }}><Turnstile key={tsKey} onToken={onToken} action="analyse" /></div>}
      <section className={`t8-hero${hasCar ? "" : " t8-idle"}`} aria-labelledby="t8-h">
        {hasCar && (
          <button type="button" className="t8-back" data-testid="flow-back" onClick={goBack} aria-label={refined ? "Back to the details" : "Back to the start"}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
          </button>
        )}
        <div className="t8-main">
          <div className="t8-readout">
            {!hasCar ? (
              <>
                <h1 id="t8-h" className="t8-h1 t8-h1-bs">Free car valuation<br /><em>by registration.</em></h1>
                <p className="t8-sub t8-sub-bs">Know its value. Make the right move. Get a free UK car valuation from the number plate in seconds, then unlock personalised insights to help you negotiate with confidence.</p>
              </>
            ) : shown.band ? (
              <>
                <h1 id="t8-h" className="sr-only">Your free estimate</h1>
                <FitPrice key={refined ? "r" : "e"} text={bandText(shown.band)} className="t8-price" boxClassName="t8-pricebox" minPx={36} floorPx={16} testId="t8-price">
                  {(lines) => lines.map((l, i) => <RollingPrice key={i} text={l} />)}
                </FitPrice>
                <div className="t8-meta">{shown.early ? "Early estimate, firming up" : refined ? "Updated with your details" : "Private sale"}</div>
                {!shown.early && shown.band.why && <p className="t8-range-why" data-testid="t8-range-why">{shown.band.why}</p>}
                {grade && (
                  <div className="t8-grade" style={{ color: grade.color, borderColor: `${grade.color}59`, background: `${grade.color}14` }} aria-label={`Car grade: ${grade.label}`}>{grade.label}</div>
                )}
              </>
            ) : (
              <>
                <h1 id="t8-h" className="sr-only">Your car</h1>
                <div className="t8-price" style={{ opacity: 0.35 }} aria-hidden>{stage === "estimating" ? "£–" : unavailable ? "" : "£–"}</div>
                <div className="t8-meta">{stage === "estimating" ? "Working out your estimate" : unavailable ? "We couldn't price this one" : locked || (guestLimit && premiumBusy && limitKind === "free") ? "Unlocks with your Premium Report" : needMileage ? "Add your mileage below" : "Private sale"}</div>
              </>
            )}
          </div>
          <div className="t8-viz">
            <PriceArc from={fr?.from ?? null} to={fr?.to ?? null} color={grade?.color} />
            <img key={carSrc} className={`t8-car ${hasCar ? "in" : "idle"}`} src={carSrc} alt="" width={960} height={540} decoding="async" fetchPriority="high" />
          </div>
          {hasCar && lookup && (
            <div className="t8-stagger" style={{ textAlign: "center" }}>
              <div className="t8-platewrap">
                <div className="reg-plate"><div className="reg-plate-inner">
                  <div className="reg-plate-badge" aria-hidden><img src="/uk-flag.svg" alt="" /><b>UK</b></div>
                  <div className="reg-plate-input" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Registration">{fmtReg(lookup.registration)}</div>
                </div></div>
              </div>
              <div className="t8-vehicle">
                <div className="t8-name">{name}</div>
                <div className="t8-facts">{refined && milesNum ? `${milesNum.toLocaleString("en-GB")} miles` : facts}</div>
              </div>
            </div>
          )}
        </div>

        {!hasCar && (
          <form className="t8-sheet t8-float" onSubmit={(e) => { e.preventDefault(); void start(undefined, premiumArmed); }}>
            <label htmlFor="home-reg" className="t8-label">Enter the registration</label>
            <div className="reg-plate"><div className="reg-plate-inner">
              <div className="reg-plate-badge" aria-hidden><img src="/uk-flag.svg" alt="" /><b>UK</b></div>
              <input id="home-reg" ref={regInput} value={reg} disabled={busyLookup}
                onFocus={() => track("valuation_started")}
                onChange={(e) => { setReg(e.target.value.toUpperCase()); setErr(null); if (e.target.value.trim()) { track("valuation_started"); track("reg_typed"); } }}
                placeholder="AB12 CDE" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} enterKeyHint="go"
                aria-invalid={!!err} size={1} className="reg-plate-input" />
            </div></div>
            <div className="t8-duo" style={{ marginTop: 14 }}>
              <button type="submit" className="t8-ghost" data-testid="free-valuation" disabled={busyLookup}>
                {busyLookup && !premiumBusy ? <><span className="t8-spin t8-spin-l" aria-hidden /> Checking</> : "Free Valuation"}
              </button>
              <button type="button" className={`t8-btn t8-two${premiumArmed ? " t8-armed" : ""}`} aria-pressed={premiumArmed || undefined} data-testid="premium-landing" disabled={busyLookup} onClick={() => { posthog.capture?.("Premium Report Click", { where: "landing" }); void start(undefined, true); }}>
                {busyLookup && premiumBusy ? <span className="t8-one"><span className="t8-spin" aria-hidden /> Checking</span> : <>Premium Report<small>£2.99 one-off</small></>}
              </button>
            </div>
            <p className="t8-inc" aria-live="polite">{busyLookup ? "Checking DVLA and MOT records" : premiumArmed ? "Premium Report selected. Enter the reg to continue." : "Buying or Selling, Know the right price"}</p>
            {err && <p className="t8-err" role="alert">{err} <Link className="t8-link" to="/valuation/new?manual=1">Enter details by hand</Link></p>}
            {guestLimit && <GuestLimit message={guestLimit} premium={false} />}
            <p className="t8-buyer"><Link to="/check" data-testid="buyer-check-link">Buying? Check an advert<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></Link></p>
            <p className="t8-note">We don't buy cars</p>
            {!user && !guestLimit && <p className="t8-cap" data-testid="guest-cap-note">Free guest valuations are limited each day. A free account gives you more.</p>}
          </form>
        )}

        {hasCar && !refined && (
          <button type="button" className="t8-cue" onClick={() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Add your details
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5L8 10.5L12 6.5" stroke="#8A8A8A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}

        {refined && valuationId && (
          <div className="t8-unlock" ref={unlockRef} id="report-checkout" data-testid="premium-card">
            <div className="t8-grab" aria-hidden />
            <div className="v8-pill-wrap"><span className="bs-pill"><i />{PREMIUM_NAME}</span></div>
            <p className="uh">A valuation tells you the price.<br /><em>Valu8 helps you make the deal.</em></p>
            <IntentSwitch size="sm" where="result" />
            <div className="v8-lockrows" key={intent} aria-label="Included in the Premium Report">
              {LOCKED_ROWS[intent].map((row) => (
                <div key={row.label}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" stroke="#8A8A8A" strokeWidth="1.3" /><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" stroke="#8A8A8A" strokeWidth="1.3" /></svg>
                  <span className="t">{row.label}</span><span className="dots" aria-label="Locked">{row.money ? "£•,•••" : "•••"}</span>
                </div>
              ))}
            </div>
            <button type="button" className="t8-btn" style={{ marginTop: 16 }} data-testid="offer-button" onClick={() => { track("offer_click"); saveIntentFor(valuationId, getIntent()); setCheckoutOpen(true); }}>{PREMIUM_CTA}</button>
            <p className="bs-reass"><b>One-off payment.</b> No subscription.</p>
            <p className="t8-note"><Link to={`/valuation/${valuationId}`}>See my free report</Link> · <button type="button" className="t8-link" onClick={reset}>Value another car</button></p>
          </div>
        )}
      </section>

      {hasCar && lookup && !refined && (
        <section className="t8-details" ref={detailsRef} aria-labelledby="t8-det">
          <form className="t8-details-in" onSubmit={(e) => void refine(e, premiumBusy)}>
            <h2 id="t8-det" className="t8-title">Add the car’s details</h2>
            <p className="t8-lead">We’ll update the estimate with the mileage, trim, history and photos.</p>
            <div className="t8-intent">
              <div className="t8-k">Are you buying or selling?</div>
              <IntentSwitch size="sm" where="details" />
            </div>
            {guestLimit && <GuestLimit message={guestLimit} premium={premiumBusy && limitKind === "free"} />}
            <div className="t8-factgrid t8-stagger">
              {[["Make", titleCase(lookup.make)], ["Model", titleCase(lookup.model)], ["Year", String(lookup.year ?? "")],
                ["Fuel", titleCase(lookup.fuelType)], ["Engine", lookup.engineCapacity ? `${lookup.engineCapacity.toLocaleString("en-GB")} cc` : "–"], ["Colour", titleCase(lookup.colour)]].map(([k, v]) => (
                <div key={k}><div className="t8-k">{k}</div><div className="t8-v">{v || "–"}</div></div>
              ))}
            </div>
            <div className="t8-row t8-stagger">
              <div className="t8-field">
                <label htmlFor="t8-trim">Trim / version <span className="opt">(optional, but it can change the value a lot)</span></label>
                <input id="t8-trim" maxLength={60} autoComplete="off" placeholder="e.g. Renaultsport 200, ST-2, GTI, M Sport, AMG" value={variant}
                  onChange={(e) => { setVariant(e.target.value); setTrimAuto(false); }} />
                {trimHint ? (
                  <div className="t8-chips" data-testid="trim-hint">
                    <span>{trimHint.confident || trimHint.allPerf
                      ? trimHint.options.length === 1 ? `The ${trimHint.reason} was only sold as the ${trimHint.options[0]}.` : `The ${trimHint.reason} was only sold as a performance version. Which is it?`
                      : `The ${trimHint.reason} is often a performance version. Is it one of these?`}</span>
                    {[...trimHint.options, ...(trimHint.confident || trimHint.allPerf ? [] : ["Neither"])].map((o) => {
                      const val = o === "Neither" ? "" : o; const on = o === "Neither" ? !variant : variant === o;
                      return <button key={o} type="button" className="t8-chip" aria-pressed={on} onClick={() => { setVariant(val); setTrimAuto(false); }}>{o}</button>;
                    })}
                  </div>
                ) : <span className="t8-hint">DVLA records don't include the trim. Performance versions (RS, ST, GTI, R, AMG, M, vRS, Type R) are worth much more, so add it if you know it.</span>}
                {trimAuto && <span className="t8-hint">Filled in from the engine size. Change it if it's wrong.</span>}
              </div>
              <div className="t8-field">
                <label id="t8-gb-l">Gearbox</label>
                <div className="t8-seg" role="radiogroup" aria-labelledby="t8-gb-l" data-v={gearbox || undefined} data-testid="gearbox">
                  <span className="t8-seg-thumb" aria-hidden />
                  {(["Automatic", "Manual"] as const).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={gearbox === g} onClick={() => { setGearbox(g); setGearboxGuessed(false); }}>{g}</button>
                  ))}
                </div>
                {gearboxGuessed && <span className="t8-hint">Most of these are {gearbox.toLowerCase()}. Change it if this one isn't.</span>}
              </div>
              <div className="t8-row2">
                <div className="t8-field">
                  <label htmlFor="t8-miles">Current mileage</label>
                  <input id="t8-miles" inputMode="numeric" placeholder="e.g. 64,500" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ""))} />
                  <span className="t8-hint">{mileageHint(lookup)}</span>
                </div>
                <div className="t8-field">
                  <label htmlFor="t8-mods">Modifications <span className="opt">(optional)</span></label>
                  <input id="t8-mods" maxLength={200} placeholder="e.g. New tyres" value={mods} onChange={(e) => setMods(e.target.value)} />
                </div>
              </div>
              {intent === "buying" && (
                <div className="t8-field t8-asking">
                  <label htmlFor="t8-asking">Advertised asking price <span className="opt">(optional)</span></label>
                  <input id="t8-asking" inputMode="numeric" placeholder="e.g. 8,495" value={asking} data-testid="asking-price"
                    onChange={(e) => setAsking(e.target.value.replace(/[^\d,£]/g, ""))} />
                  <span className="t8-hint">From the advert. The Premium Report compares it with the valuation and suggests an opening offer.</span>
                </div>
              )}
              <div className="t8-field">
                <label htmlFor="t8-notes">Service history notes</label>
                <textarea id="t8-notes" rows={3} maxLength={500} placeholder="e.g. Full service history, cambelt at 60k, four new tyres last summer." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div style={{ margin: "22px 0 18px" }}>
              <div className="t8-photohead">
                <h3 className="t8-h3" style={{ margin: 0 }}>Photos <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "#8A8A8A" }}>(optional)</span></h3>
                {photos.length < PHOTO_SLOTS.length && (
                  <button type="button" className="t8-bulk" data-testid="bulk-upload" onClick={() => bulkInput.current?.click()}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Upload all
                  </button>
                )}
              </div>
              <p className="t8-hint" style={{ margin: "6px 0 10px" }}>{intent === "buying" ? "Photos from the advert or a viewing help us spot condition issues that affect the price." : "A few photos help us spot condition issues and selling points that move the price."}</p>
              <input ref={slotInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
              <input ref={bulkInput} type="file" accept="image/*" multiple hidden onChange={pickBulk} aria-label="Upload several photos" />
              <div className="t8-photos t8-stagger">
                {PHOTO_SLOTS.map((s) => {
                  const ph = photos.find((p) => p.key === s.key);
                  return (
                    <div className="t8-slot" key={s.key}>
                      <button type="button" className="t8-box" aria-label={`Add ${s.label} photo`} onClick={() => { slotTarget.current = s.key; slotInput.current?.click(); }}>
                        {ph ? <img src={ph.preview} alt="" /> : <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ opacity: 0.3 }}><path d="M9 3.5v11M3.5 9h11" stroke="#F7F5F3" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                        {ph && <span role="button" tabIndex={0} aria-label="Remove photo" className="t8-x" onClick={(e) => { e.stopPropagation(); setPhotos((ps) => ps.filter((p) => p.key !== s.key)); }}>×</span>}
                      </button>
                      <span>{SHORT_SLOT[s.key] ?? s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div ref={payRef} style={{ scrollMarginBottom: 120 }}>
            {err && stage === "estimate" && <p className="t8-err" role="alert" style={{ textAlign: "left", marginBottom: 14 }}>{err}</p>}
            {payErr && (
              <div className="t8-payerr" role="alert" data-testid="pay-error">
                <p>{payErr}</p>
                {payErr !== UNPRICEABLE && <button type="button" className="t8-link" onClick={() => void refine(undefined, true)}>Try again</button>}
              </div>
            )}
            {premiumBusy ? (
              <div className={`t8-solo${nudgePay ? " t8-nudge" : ""}`} key="solo">
                <button type="submit" className="t8-btn t8-two" data-testid="pay-premium" disabled={stage === "estimating" || stage === "refining"}>Pay for Premium Report<small>£2.99 one-off</small></button>
              </div>
            ) : (
              <div className="t8-duo" key="duo">
                <button type="submit" className="t8-ghost" data-testid="finish-valuation" disabled={stage === "estimating" || stage === "refining"}>Finish Valuation</button>
                <button type="button" className="t8-btn t8-two" data-testid="premium-details" disabled={stage === "estimating" || stage === "refining"} onClick={() => void refine(undefined, true)}>Premium Report<small>£2.99 one-off</small></button>
              </div>
            )}
            </div>
            <p className="t8-inc">{includesLine(intent)}</p>
            <p className="t8-small">{lookup.registration ? <>Wrong car? <button type="button" className="t8-link" onClick={reset}>Check another plate</button></> : null}</p>
          </form>
        </section>
      )}

      {stage === "refining" && (
        <RingLoader
          out={loaderOut}
          title={premiumBusy && !band ? "Preparing your report" : "Updating the valuation"}
          status={progress < 25 ? "Checking records" : progress < 50 ? "Reading MOT history" : progress < 75 ? (photos.length ? "Looking at the photos" : "Matching the details") : "Pricing"}
          progress={progress}
          steps={[
            { title: "Checking records", sub: "Official vehicle record" },
            { title: "Reading MOT history", sub: "DVSA tests and advisories" },
            photos.length ? { title: "Looking at the photos", sub: "Panels, wheels and interior" } : { title: "Matching the details", sub: "Trim, mileage and history" },
            { title: "Pricing", sub: "Updating with the details" },
          ]}
        />
      )}

      {checkoutOpen && valuationId && (
        <CheckoutSheet title={PREMIUM_TITLE} label={`${PREMIUM_NAME} checkout`} onClose={() => {
          sheetCloseRef.current = null;
          setCheckoutOpen(false);
          // Closed with the X, a tap outside or a swipe: drop the checkout's history entry too.
          if (viewOf(locRef.current.state) === "checkout") navigate(-1);
        }}>
          {(close) => { sheetCloseRef.current = close; return (
            <ElementsCheckout valuationId={valuationId} email={user?.email || undefined} onPaid={() => navigate(`/valuation/${valuationId}?intent=${getIntent()}`, { replace: viewOf(locRef.current.state) === "checkout" })} onClose={close}
              title={PREMIUM_TITLE} hideHeader
              intro={
                <>
                  {lookup && (
                    <div className="t8-co-car">
                      <img src={carSrc} alt="" width={96} height={54} />
                      <div className="t8-co-tx">
                        <div className="t8-co-n">{name}</div>
                        {lookup.registration && <span className="t8-mp"><img src="/uk-flag.svg" alt="" /><span>{fmtReg(lookup.registration)}</span></span>}
                      </div>
                      <div className="t8-co-pr">£2.99</div>
                    </div>
                  )}
                  <div className="v8-forl"><span>This report is for</span><IntentSwitch size="xs" where="checkout" /></div>
                  <div className="t8-wi" data-testid="premium-includes" key={intent}>
                    <h3>What's in your {PREMIUM_NAME}</h3>
                    <ul>
                      {includesFor(intent).map((i) => (
                        <li key={i}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="8.25" fill="rgba(0,214,200,.14)" stroke="#00D6C8" strokeWidth="1.2" /><path d="M5.6 9.2l2.2 2.2 4.6-4.7" stroke="#1AFFF0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{i}</span></li>
                      ))}
                    </ul>
                  </div>
                </>
              } />
          ); }}
        </CheckoutSheet>
      )}
    </div>
  );
}

const UNPRICEABLE = "We couldn't price this car, so there's nothing to pay for. Check the details or try another plate.";

/** Daily guest limit. On the premium path (free valuations used up, paid report still open) it is a soft note, not a blocker. */
export function GuestLimit({ message, premium }: { message: string; premium: boolean }) {
  const box = { marginTop: 14, marginBottom: 14, borderRadius: 14, border: "1px solid rgba(0,214,200,.3)", background: "rgba(0,214,200,.06)", padding: 14, textAlign: "left" as const };
  if (premium) {
    return (
      <div role="status" data-testid="guest-limit-soft" style={box}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Today's free valuations are used up</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#ADADAD", lineHeight: 1.45 }}>You can still get the {PREMIUM_NAME} below. For more free valuations, <Link to="/auth?mode=signup" className="t8-link">create a free account</Link>.</p>
      </div>
    );
  }
  return (
    <div role="alert" data-testid="guest-limit" style={box}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>You've used today's free guest valuations</p>
      <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#ADADAD", lineHeight: 1.45 }}>{message.replace(/\s*[\u2014\u2013]\s*(\w)/g, (_m, c: string) => `. ${c.toUpperCase()}`)}</p>
      <Link to="/auth?mode=signup" className="t8-link" style={{ fontSize: 14 }}>Create a free account</Link>
    </div>
  );
}

