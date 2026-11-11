import "@/styles/plate.css";
import "@/styles/tesla.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { posthog } from "@/lib/posthog";
import { isFoundVehicle, isPlausibleUkReg, normaliseReg } from "@/lib/registration";
import { Turnstile, turnstileEnabled, turnstileHeaders } from "@/components/Turnstile";
import { getAttribution } from "@/lib/attribution";
import { getUtm, track } from "@/lib/funnel";
import { inferPerformanceTrim, type TrimHint } from "@/lib/perfTrim";
import { functionErrorBody, getGuestToken, photoToDataUrl, rememberGuestValuation } from "@/lib/guest";
import { PHOTO_SLOTS, fillEmptySlots, type PhotoSlotKey } from "@/lib/cars";
import { normaliseReportPricing } from "@/lib/askingPrice";
import { reportPriceRange } from "../../../supabase/functions/_shared/cheapRange";
import { ElementsCheckout, REPORT_CTA } from "@/components/ReportCheckout";
import { bodyKeyFor, carImageSrc, type BodyKey } from "./carImage";
import { renderFor } from "./modelRenders";
import { gradeArc, gradeFromReport, type CarGrade } from "@/lib/carGrade";
import { PriceArc, RingLoader, RollingPrice, useEasedProgress } from "./parts";

interface Lookup {
  registration: string; make?: string; model?: string; variant?: string; year?: number; fuelType?: string; transmission?: string; transmissionGuess?: Gearbox;
  colour?: string; firstRegistered?: string; manufactureYear?: number; engineCapacity?: number; bodyStyle?: string; doors?: number;
  co2Emissions?: number; motExpiry?: string; lastMileage?: number; recentAdvisories?: string[];
}
type Gearbox = "Automatic" | "Manual";
/** Provider gearbox text -> chip value ("Semi-Auto", "DSG", "CVT" count as automatic). */
const gearboxOf = (t?: string): Gearbox | "" => (/auto|semi|dsg|cvt|tiptronic|steptronic|tronic|pdk|dct/i.test(t ?? "") ? "Automatic" : /manual/i.test(t ?? "") ? "Manual" : "");
interface Photo { key: PhotoSlotKey; file: File; preview: string }
type Stage = "idle" | "looking" | "estimating" | "estimate" | "refining" | "refined";
interface Band { low: number; high: number; single: boolean }

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
  return r ? { low: r.low, high: r.high, single: false } : { low: p, high: p, single: true };
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
  const [unavailable, setUnavailable] = useState(false);
  const [grade, setGrade] = useState<CarGrade | null>(null);
  const [refineDone, setRefineDone] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [needMileage, setNeedMileage] = useState(false);
  const tsRef = useRef<string | null>(null);
  const [tsKey, setTsKey] = useState(0);
  const [tsOn, setTsOn] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const unlockRef = useRef<HTMLDivElement>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);
  const slotTarget = useRef<PhotoSlotKey | null>(null);

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

  function analyseBody(l: Lookup, extra: { mileage: number; variant: string; transmission?: Gearbox | ""; mods?: string; notes?: string; photoUrls?: string[]; photosLabeled?: { slot: string; url: string }[]; guestPhotos?: { slot: string; dataUrl: string }[]; refineOf?: string | null }) {
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
      if (!user && status === 429 && eb?.code === "guest_limit") { posthog.capture?.("Guest Limit Reached", {}); setGuestLimit(eb.error); return null; }
      if (!user && status === 401) { navigate(`/valuation/new?reg=${encodeURIComponent(l.registration)}`); return null; }
      throw new Error(eb?.error || "We couldn't value this car just now. Please try again.");
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    const report = (data as any)?.report;
    if (!report) throw new Error("We couldn't value this car just now. Please try again.");
    if (!user) {
      const id = (data as any)?.valuationId as string | undefined;
      if (!id) throw new Error("We couldn't save your valuation. Please try again.");
      rememberGuestValuation(id);
      return { id, report };
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
      if (!uErr) return { id: existingId, report };
    }
    const { data: ins, error: iErr } = await supabase.from("valuations").insert({ user_id: user.id, ...row, ...getUtm() }).select("id").single();
    if (iErr) throw iErr;
    return { id: ins.id as string, report };
  }

  async function start(raw?: string) {
    const cleaned = normaliseReg(raw ?? reg);
    if (!isPlausibleUkReg(cleaned)) { setErr("Enter a valid UK number plate, e.g. AB12 CDE."); return; }
    setErr(null); setGuestLimit(null); setStage("looking"); setBand(null); setValuationId(null); setGrade(null); setNeedMileage(false);
    if (turnstileEnabled()) setTsOn(true);
    let l: Lookup;
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vehicle", { body: { registration: cleaned } });
      if (error) {
        const { status, body } = await functionErrorBody(error);
        if (status === 401 && !user) { navigate(`/valuation/new?reg=${encodeURIComponent(cleaned)}`); return; }
        if (status === 429 && body?.code === "guest_limit") { setGuestLimit(body.error); setStage("idle"); return; }
        if (body?.code === "lookup_unavailable") throw new Error("Our vehicle lookup is busy right now. Try again in a few minutes, or enter the details by hand.");
        throw new Error(body?.error || "We couldn't find a car with that registration.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      l = data as Lookup;
      if (!isFoundVehicle(l)) throw new Error("We couldn't find a car with that registration.");
    } catch (e: any) {
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
      setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 700);
      return;
    }
    setStage("estimating");
    track("submitted");
    try {
      const res = await value(l, { mileage: l.lastMileage, variant: v, transmission: gb }, null);
      if (!res) { setStage("estimate"); return; }
      applyResult(res.id, res.report, true, l.lastMileage, l);
      setStage("estimate");
    } catch (e: any) {
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

  async function refine(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    const miles = Number(mileage.replace(/[,\s]/g, ""));
    if (!Number.isFinite(miles) || miles < 0 || miles > 500000 || mileage.trim() === "") { setErr("Enter the current mileage."); return; }
    setErr(null); setGuestLimit(null); setRefineDone(false); setStage("refining");
    track("submitted");
    if (photos.length) track("step_photos");
    const t0 = Date.now();
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
      const res = await value(lookup, { mileage: miles, variant, transmission: gearbox, mods, notes, photoUrls, photosLabeled: labeled, guestPhotos, refineOf: valuationId }, valuationId);
      if (!res) { setStage("estimate"); return; }
      // Let the ring finish cleanly before revealing the result.
      const wait = Math.max(0, 1600 - (Date.now() - t0));
      setTimeout(() => setRefineDone(true), wait);
      setTimeout(() => {
        applyResult(res.id, res.report, !band, miles, lookup);
        setStage("refined");
        window.scrollTo({ top: 0, behavior: "auto" });
      }, wait + 1300);
    } catch (e2: any) {
      setErr(e2?.message || "We couldn't update the valuation. Please try again.");
      setStage("estimate");
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
    setStage("idle"); setLookup(null); setBand(null); setValuationId(null); setGrade(null); setErr(null); setGuestLimit(null);
    setPhotos([]); setMods(""); setNotes(""); setReg(""); setCheckoutOpen(false); setGearbox(""); setGearboxGuessed(false);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const busyLookup = stage === "looking" || stage === "estimating";
  const hasCar = !!lookup && stage !== "idle" && stage !== "looking";
  const fr = band && grade ? gradeArc(grade.index) : null;
  const name = lookup ? [lookup.year, titleCase(lookup.make), titleCase(lookup.model), variant && !(lookup.model ?? "").toLowerCase().includes(variant.toLowerCase()) ? (variant.toLowerCase().startsWith(`${(lookup.model ?? "").toLowerCase().split(" ")[0]} `) ? variant.slice((lookup.model ?? "").split(" ")[0].length).trim() : variant) : ""].filter(Boolean).join(" ") : "";
  const facts = lookup ? [lookup.engineCapacity ? `${lookup.engineCapacity.toLocaleString("en-GB")} cc` : "", titleCase(lookup.fuelType), titleCase(lookup.colour)].filter(Boolean).join(" · ") : "";
  const refined = stage === "refined";
  const milesNum = Number(mileage.replace(/[,\s]/g, ""));

  return (
    <div className="t8" ref={topRef}>
      <div className="t8-bgglow" aria-hidden />
      {turnstileEnabled() && tsOn && <div style={{ position: "absolute", left: 0, bottom: 0, zIndex: 5 }}><Turnstile key={tsKey} onToken={onToken} action="analyse" /></div>}
      <section className="t8-hero" aria-labelledby="t8-h">
        <div className="t8-main">
          <div className="t8-readout">
            {!hasCar ? (
              <>
                <h1 id="t8-h" className="t8-h1">What’s your car worth?</h1>
                <p className="t8-sub">Find out free from your number plate.</p>
              </>
            ) : band ? (
              <>
                <h1 id="t8-h" className="sr-only">Your free estimate</h1>
                <RollingPrice key={refined ? "r" : "e"} text={bandText(band)} className="t8-price" />
                <div className="t8-meta">{refined ? "Updated with your details" : "Private sale"}</div>
                {grade && (
                  <div className="t8-grade" style={{ color: grade.color, borderColor: `${grade.color}59`, background: `${grade.color}14` }} aria-label={`Car grade: ${grade.label}`}>{grade.label}</div>
                )}
              </>
            ) : (
              <>
                <h1 id="t8-h" className="sr-only">Your car</h1>
                <div className="t8-price" style={{ opacity: 0.35 }} aria-hidden>{stage === "estimating" ? "£–" : unavailable ? "" : "£–"}</div>
                <div className="t8-meta">{stage === "estimating" ? "Working out your estimate" : unavailable ? "We couldn't price this one" : needMileage ? "Add your mileage below" : "Private sale"}</div>
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
          <form className="t8-sheet" onSubmit={(e) => { e.preventDefault(); void start(); }}>
            <div className="t8-grab" aria-hidden />
            <label htmlFor="home-reg" className="t8-label">Enter your registration</label>
            <div className="reg-plate"><div className="reg-plate-inner">
              <div className="reg-plate-badge" aria-hidden><img src="/uk-flag.svg" alt="" /><b>UK</b></div>
              <input id="home-reg" value={reg} disabled={busyLookup}
                onFocus={() => track("valuation_started")}
                onChange={(e) => { setReg(e.target.value.toUpperCase()); setErr(null); if (e.target.value.trim()) { track("valuation_started"); track("reg_typed"); } }}
                placeholder="AB12 CDE" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} enterKeyHint="go"
                aria-invalid={!!err} size={1} className="reg-plate-input" />
            </div></div>
            <button type="submit" className="t8-btn" style={{ marginTop: 14 }} disabled={busyLookup}>
              {busyLookup ? <><span className="t8-spin" aria-hidden /> Checking DVLA and MOT records</> : "Value my car free"}
            </button>
            {err && <p className="t8-err" role="alert">{err} <Link className="t8-link" to="/valuation/new">Enter details by hand</Link></p>}
            {guestLimit && <GuestLimit message={guestLimit} />}
            <p className="t8-note">Free · no account needed · we don't buy cars</p>
          </form>
        )}

        {hasCar && !refined && (
          <button type="button" className="t8-cue" onClick={() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Add your details
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6.5L8 10.5L12 6.5" stroke="#8A8A8A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}

        {refined && valuationId && (
          <div className="t8-unlock" ref={unlockRef} id="report-checkout">
            <div className="t8-grab" aria-hidden />
            <p className="lead">{band && !band.single
              ? "The report narrows this range to one suggested asking price, with typical asking prices from UK adverts."
              : "The report turns this into one suggested asking price, with typical asking prices from UK adverts."}</p>
            <button type="button" className="t8-btn" data-testid="offer-button" onClick={() => { track("offer_click"); setCheckoutOpen(true); }}>{REPORT_CTA}</button>
            <p className="t8-note">One-off · no subscription</p>
            <p className="t8-note"><Link to={`/valuation/${valuationId}`}>See my free report</Link> · <button type="button" className="t8-link" onClick={reset}>Value another car</button></p>
          </div>
        )}
      </section>

      {hasCar && lookup && !refined && (
        <section className="t8-details" ref={detailsRef} aria-labelledby="t8-det">
          <form className="t8-details-in" onSubmit={refine}>
            <h2 id="t8-det" className="t8-title">Add your details</h2>
            <p className="t8-lead">We’ll update the estimate with your mileage, trim, history and photos.</p>
            {err && stage === "estimate" && <p className="t8-err" role="alert" style={{ textAlign: "left", marginBottom: 14 }}>{err}</p>}
            {guestLimit && <GuestLimit message={guestLimit} />}
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
                      ? trimHint.options.length === 1 ? `The ${trimHint.reason} was only sold as the ${trimHint.options[0]}.` : `The ${trimHint.reason} was only sold as a performance version. Which is yours?`
                      : `The ${trimHint.reason} is often a performance version. Is yours one of these?`}</span>
                    {[...trimHint.options, ...(trimHint.confident || trimHint.allPerf ? [] : ["Neither"])].map((o) => {
                      const val = o === "Neither" ? "" : o; const on = o === "Neither" ? !variant : variant === o;
                      return <button key={o} type="button" className="t8-chip" aria-pressed={on} onClick={() => { setVariant(val); setTrimAuto(false); }}>{o}</button>;
                    })}
                  </div>
                ) : <span className="t8-hint">DVLA records don't include the trim. Performance versions (RS, ST, GTI, R, AMG, M, vRS, Type R) are worth much more, so add yours.</span>}
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
                {gearboxGuessed && <span className="t8-hint">Most of these are {gearbox.toLowerCase()}. Change it if yours isn't.</span>}
              </div>
              <div className="t8-row2">
                <div className="t8-field">
                  <label htmlFor="t8-miles">Current mileage</label>
                  <input id="t8-miles" inputMode="numeric" placeholder="e.g. 64,500" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ""))} />
                  {lookup.lastMileage ? <span className="t8-hint">Last MOT recorded {lookup.lastMileage.toLocaleString("en-GB")} mi</span> : null}
                </div>
                <div className="t8-field">
                  <label htmlFor="t8-mods">Modifications <span className="opt">(optional)</span></label>
                  <input id="t8-mods" maxLength={200} placeholder="e.g. New tyres" value={mods} onChange={(e) => setMods(e.target.value)} />
                </div>
              </div>
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
            <button type="submit" className="t8-btn" disabled={stage === "estimating" || stage === "refining"}>Update with my details</button>
            <p className="t8-small">{lookup.registration ? <>Not your car? <button type="button" className="t8-link" onClick={reset}>Check another plate</button></> : null}</p>
          </form>
        </section>
      )}

      {stage === "refining" && (
        <RingLoader
          title="Updating your valuation"
          status={progress < 25 ? "Checking records" : progress < 50 ? "Reading MOT history" : progress < 75 ? (photos.length ? "Looking at your photos" : "Matching your details") : "Pricing"}
          progress={progress}
          steps={[
            { title: "Checking records", sub: "Official vehicle record" },
            { title: "Reading MOT history", sub: "DVSA tests and advisories" },
            photos.length ? { title: "Looking at your photos", sub: "Panels, wheels and interior" } : { title: "Matching your details", sub: "Trim, mileage and history" },
            { title: "Pricing", sub: "Updating with your details" },
          ]}
        />
      )}

      {checkoutOpen && valuationId && (
        <div className="t8-checkout" role="dialog" aria-modal="true" aria-label="Full Valuation Report checkout" onClick={(e) => { if (e.target === e.currentTarget) setCheckoutOpen(false); }}>
          <div className="t8-checkout-in">
            <ElementsCheckout valuationId={valuationId} email={user?.email || undefined} onPaid={() => navigate(`/valuation/${valuationId}`)} onClose={() => setCheckoutOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function GuestLimit({ message }: { message: string }) {
  return (
    <div role="alert" style={{ marginTop: 14, borderRadius: 14, border: "1px solid rgba(0,214,200,.3)", background: "rgba(0,214,200,.06)", padding: 14, textAlign: "left" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>You've used today's free guest valuations</p>
      <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#ADADAD", lineHeight: 1.45 }}>{message}</p>
      <Link to="/auth?mode=signup" className="t8-link" style={{ fontSize: 14 }}>Create a free account</Link>
    </div>
  );
}

