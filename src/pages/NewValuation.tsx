import { useEffect, useRef, useState } from "react";
import { isFoundVehicle, isPlausibleUkReg, normaliseReg } from "@/lib/registration";
import { Turnstile, turnstileEnabled, turnstileHeaders } from "@/components/Turnstile";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { useAuth } from "@/contexts/AuthContext";
import { Header, TestModeBanner } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlowSteps } from "@/components/FlowSteps";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { UploadProgressModal, type UploadPhase } from "@/components/UploadProgressModal";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import {
  ArrowRight, Search, Loader2, CheckCircle2, Pencil, AlertCircle, Car,
  ShieldCheck, Clock, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAttribution } from "@/lib/attribution";
import { useSeo } from "@/lib/seo";
import { inferPerformanceTrim, type TrimHint } from "@/lib/perfTrim";
import { GUEST_DAILY_CAP, functionErrorBody, getGuestToken, photoToDataUrl, rememberGuestValuation } from "@/lib/guest";

interface LookupResult {
  registration: string;
  make?: string;
  model?: string;
  /** Trim from the vehicle-data provider, when it has one (DVLA never does). */
  variant?: string;
  year?: number;
  fuelType?: string;
  transmission?: string;
  colour?: string;
  firstRegistered?: string;
  engineCapacity?: number;
  bodyStyle?: string;
  co2Emissions?: number;
  motExpiry?: string;
  motStatus?: "Valid" | "Expired" | "Unknown";
  motSummary?: string;
  lastMileage?: number;
  recentAdvisories?: string[];
}

const finalSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileage: z.coerce.number().int().min(0).max(500000),
});

const LOOKUP_STAGES = ["Checking DVLA…", "Reading MOT history…", "Matching spec…"];

export default function NewValuation() {
  const { user } = useAuth();
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsKey, setTsKey] = useState(0);
  const navigate = useNavigate();

  // Lookup state
  const [reg, setReg] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupStage, setLookupStage] = useState(0);
  useEffect(() => {
    if (!looking) { setLookupStage(0); return; }
    const t = window.setInterval(() => setLookupStage((v) => Math.min(v + 1, LOOKUP_STAGES.length - 1)), 1800);
    return () => clearInterval(t);
  }, [looking]);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Editable vehicle fields (populated by lookup, overridable)
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  // Performance trim implied by the engine (e.g. a 1.6 petrol Clio is a Renaultsport).
  const [trimHint, setTrimHint] = useState<TrimHint | null>(null);
  const [trimAuto, setTrimAuto] = useState(false);
  const [year, setYear] = useState("");

  // Manual additions
  const [mileage, setMileage] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [modifications, setModifications] = useState("");

  // Photos + submission
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Set when a guest hits the server-side daily cap.
  const [guestLimit, setGuestLimit] = useState<string | null>(null);

  useSeo({ title: "New valuation — Valu8", description: "Enter a UK registration to get a free private sale valuation in minutes.", path: "/valuation/new" });

  // Homepage plate box: /valuation/new?reg=AB12CDE prefills and starts the lookup once.
  const [searchParams, setSearchParams] = useSearchParams();
  const regParamHandled = useRef(false);
  useEffect(() => {
    const raw = searchParams.get("reg");
    if (!raw || regParamHandled.current) return;
    regParamHandled.current = true;
    const cleaned = normaliseReg(raw);
    const next = new URLSearchParams(searchParams); next.delete("reg");
    setSearchParams(next, { replace: true });
    if (!cleaned) return;
    setReg(cleaned);
    if (isPlausibleUkReg(cleaned)) setTimeout(() => { runLookup(cleaned); }, 0);
    else setLookupError("That doesn't look like a valid UK registration (e.g. AB12 CDE).");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore pending intent after sign-in/up
  useEffect(() => {
    if (!user) return;
    try {
      const raw = sessionStorage.getItem("valu8_pending_intent");
      if (!raw) return;
      sessionStorage.removeItem("valu8_pending_intent");
      const intent = JSON.parse(raw) as { kind: "lookup" | "manual"; reg?: string };
      if (intent.kind === "lookup" && intent.reg) {
        setReg(intent.reg);
        // Trigger lookup on next tick so state is set
        setTimeout(() => { runLookup(intent.reg!); }, 0);
      } else if (intent.kind === "manual") {
        setLookup({ registration: "" });
        setEditing(true);
      }
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function runLookup(cleaned: string) {
    setLooking(true);
    setLookupError(null);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vehicle", {
        body: { registration: cleaned },
      });
      if (error) {
        // Non-2xx responses carry the server's friendly message in the body.
        const { status, body } = await functionErrorBody(error);
        if (status === 401 && !user) { sendToAuth({ kind: "lookup", reg: cleaned }); return; }
        if (status === 429 && body?.code === "guest_limit") { setGuestLimit(body.error); return; }
        throw new Error(body?.error || "We couldn't find a vehicle with that registration.");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as LookupResult;
      // Never show "Vehicle found" with blank fields: an unidentified car is an error.
      if (!isFoundVehicle(result)) throw new Error("We couldn't find a vehicle with that registration.");
      setLookup(result);
      setMake(result.make ?? "");
      setModel(result.model ?? "");
      setYear(result.year ? String(result.year) : "");
      // DVLA gives a bare model ("Clio"), so a Clio RS was valued as a base 1.6. Keep any provider
      // trim, else infer the performance version from the engine and show it for the owner to confirm.
      const providerTrim = (result.variant ?? "").trim();
      const hint = providerTrim ? null : inferPerformanceTrim({
        make: result.make, model: result.model, fuel: result.fuelType, cc: result.engineCapacity,
        year: result.year, gearbox: result.transmission,
      });
      setTrimHint(hint);
      setVariant(providerTrim || (hint?.confident ? hint.variant : ""));
      setTrimAuto(!providerTrim && !!hint?.confident);
      if (result.lastMileage && !mileage) setMileage(String(result.lastMileage));
      toast.success("Vehicle found");
    } catch (err: any) {
      const msg = err?.message || "We couldn't find a vehicle with that registration.";
      setLookupError(`${msg} Check the plate, or enter the details manually.`);
      toast.error(msg);
    } finally {
      setLooking(false);
    }
  }

  // Only used if the backend still requires an account (older deploy) — keeps guests unstuck.
  function sendToAuth(intent: { kind: "lookup" | "manual"; reg?: string }) {
    try { sessionStorage.setItem("valu8_pending_intent", JSON.stringify(intent)); } catch { /* storage unavailable */ }
    toast.message("Sign in to get your valuation", { description: "We'll pick up right where you left off." });
    navigate("/auth");
  }

  async function handleLookup() {
    const cleaned = normaliseReg(reg);
    if (!isPlausibleUkReg(cleaned)) {
      setLookupError("That doesn't look like a valid UK registration (e.g. AB12 CDE).");
      toast.error("Enter a valid UK registration");
      return;
    }
    await runLookup(cleaned);
  }

  function handleManualEntry() {
    setLookupError(null);
    setLookup({ registration: "" });
    setEditing(true);
  }

  function resetLookup() {
    setLookup(null);
    setEditing(false);
    setMake(""); setModel(""); setVariant(""); setYear(""); setTrimHint(null); setTrimAuto(false);
    setMileage(""); setServiceNotes(""); setModifications("");
    setPhotos([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const labels: Record<string, string> = { make: "Make", model: "Model", year: "Year", mileage: "Mileage" };
    const parsed = finalSchema.safeParse({
      make: make.trim(),
      model: model.trim(),
      year: year.toString().trim(),
      mileage: mileage.toString().replace(/[,\s]/g, "").trim(),
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      const missing: string[] = [];
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "");
        if (k && !fe[k]) {
          fe[k] = i.message || "Required";
          missing.push(labels[k] || k);
        }
      }
      setErrors(fe);
      // Auto-open edit mode so user can see/fix the fields
      if (missing.some((m) => ["Make", "Model", "Year"].includes(m))) setEditing(true);
      toast.error(`Please check: ${missing.join(", ")}`);
      return;
    }
    setErrors({});

    setBusy(true);
    setPhase("uploading");
    setUploadProgress(photos.length === 0 ? 100 : 0);
    const t0 = Date.now();
    posthog.capture?.("Valuation Started", {
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      mileage: parsed.data.mileage,
      photo_count: photos.length,
      has_registration: !!(lookup?.registration || reg),
    });
    try {
      const photoUrls: string[] = []; // now stores storage PATHS (private bucket)
      const photos_labeled: { slot: string; url: string }[] = [];
      // Guests can't write to Storage (RLS); analyse-vehicle stores their photos with the service role.
      const guestPhotos: { slot: string; dataUrl: string }[] = [];
      if (!user) {
        for (let i = 0; i < photos.length; i++) {
          const dataUrl = await photoToDataUrl(photos[i].file);
          if (dataUrl) guestPhotos.push({ slot: photos[i].key, dataUrl });
          setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
        }
      }
      for (let i = 0; user && i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
          contentType: p.file.type, upsert: false,
        });
        if (error) throw error;
        photoUrls.push(path);
        photos_labeled.push({ slot: p.key, url: path });
        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }
      if (photos.length > 0 && user) {
        posthog.capture?.("Photos Uploaded", {
          count: photos.length,
          slots: photos_labeled.map((p) => p.slot),
        });
      }


      setPhase("analysing");
      const vehicleFacts = {
        fuelType: lookup?.fuelType,
        transmission: lookup?.transmission,
        firstRegistered: lookup?.firstRegistered,
        engineCapacity: lookup?.engineCapacity,
        co2Emissions: lookup?.co2Emissions,
      };
      const combinedNotes = [
        serviceNotes.trim(),
        modifications.trim() ? `Modifications / extras: ${modifications.trim()}` : "",
      ].filter(Boolean).join("\n");

      const { data: aiData, error: aiErr } = await supabase.functions.invoke("analyse-vehicle", {
        body: {
          make: parsed.data.make,
          model: parsed.data.model,
          variant: variant.trim() || undefined,
          year: parsed.data.year,
          mileage: parsed.data.mileage,
          registration: lookup?.registration || reg.replace(/\s+/g, "").toUpperCase() || undefined,
          motExpiry: lookup?.motExpiry || undefined,
          serviceNotes: serviceNotes.trim() || undefined,
          modifications: modifications.trim() || undefined,
          colour: lookup?.colour || undefined,
          fuelType: lookup?.fuelType || undefined,
          transmission: lookup?.transmission || undefined,
          engineCapacity: lookup?.engineCapacity || undefined,
          bodyStyle: lookup?.bodyStyle || undefined,
          firstRegistered: lookup?.firstRegistered || undefined,
          motAdvisories: lookup?.recentAdvisories?.length ? lookup.recentAdvisories : undefined,
          photoUrls,
          photos: photos_labeled,
          ...(user ? { userId: user.id } : {
            // Guest: the edge function saves the valuation itself and returns its id.
            guestToken: getGuestToken(),
            guestPhotos,
            guestSave: {
              displayModel: variant.trim() ? `${parsed.data.model} · ${variant.trim()}` : parsed.data.model,
              serviceNotes: combinedNotes || null,
              vehicle: vehicleFacts,
              attribution: getAttribution() ?? null,
            },
          }),
        },
        headers: turnstileHeaders(tsToken),
      });
      // Turnstile tokens are single-use; get a fresh one for any retry.
      setTsToken(null); setTsKey((k) => k + 1);

      if (aiErr) {
        // Non-2xx responses carry the server's friendly message in the body.
        const { status, body } = await functionErrorBody(aiErr);
        if (!user && status === 401) { setBusy(false); sendToAuth({ kind: "lookup", reg: lookup?.registration || normaliseReg(reg) }); return; }
        if (!user && status === 429 && body?.code === "guest_limit") {
          posthog.capture?.("Guest Limit Reached", {});
          setGuestLimit(body.error); setBusy(false); return;
        }
        throw new Error(body?.error || aiErr.message);
      }
      if ((aiData as any)?.error) throw new Error((aiData as any).error);
      const report = (aiData as any)?.report;
      if (!report) throw new Error("AI did not return a report");

      if (!user) {
        const guestId = (aiData as any)?.valuationId as string | undefined;
        if (!guestId) throw new Error("We couldn't save your report — please try again.");
        rememberGuestValuation(guestId);
        posthog.capture?.("Valuation Report Generated", {
          valuation_id: guestId, guest: true,
          make: parsed.data.make, model: parsed.data.model, year: parsed.data.year,
          condition_score: report.conditionScore, private_value: report.values?.privateSale,
          photo_count: guestPhotos.length, duration_ms: Date.now() - t0,
          valuation_unavailable: !!report.valuationUnavailable,
        });
        setPhase("done");
        setTimeout(() => navigate(`/valuation/${guestId}`), 600);
        return;
      }

      // Keep the vehicle facts the client needs for tax / ULEZ estimates.
      report.vehicle = vehicleFacts;

      setPhase("generating");
      const { data, error } = await supabase.from("valuations").insert({
        user_id: user!.id,
        make: parsed.data.make,
        model: variant.trim() ? `${parsed.data.model} · ${variant.trim()}` : parsed.data.model,
        year: parsed.data.year,
        mileage: parsed.data.mileage,
        registration: lookup?.registration || null,
        mot_expiry: lookup?.motExpiry || null,
        service_notes: combinedNotes || null,
        photo_urls: photoUrls,
        condition_score: report.conditionScore,
        private_value: report.valuationUnavailable ? null : report.values.privateSale,
        report: { ...report, ...(getAttribution() ? { attribution: getAttribution() } : {}) } as any,
      }).select("id").single();
      if (error) throw error;

      posthog.capture?.("Valuation Report Generated", {
        valuation_id: data.id,
        make: parsed.data.make,
        model: parsed.data.model,
        year: parsed.data.year,
        condition_score: report.conditionScore,
        private_value: report.values?.privateSale,
        photo_count: photoUrls.length,
        duration_ms: Date.now() - t0,
        valuation_unavailable: !!report.valuationUnavailable,
      });

      setPhase("done");
      setTimeout(() => navigate(`/valuation/${data.id}`), 600);
    } catch (err: any) {
      posthog.capture?.("Valuation Failed", { message: err?.message });
      toast.error(err.message || "Failed to create valuation");
      setBusy(false);
    }
  }


  const showVehicleStep = !!lookup;

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />

      <main id="main" className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <section className="relative overflow-hidden w-full">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/10 blur-[120px]" />

          <div className="container relative pt-8 pb-4 md:pt-12 md:pb-8 text-center max-w-2xl mx-auto">
            <FlowSteps current={showVehicleStep ? (photos.length > 0 ? 2 : 1) : 0} className="mb-8" />

            <h1 className="text-[2rem] md:text-[2.85rem] font-semibold tracking-tight text-gradient leading-[1.05] animate-fade-in-up">
              Know exactly what{" "}
              <br className="hidden sm:block" />
              your car is worth
            </h1>
            <p className="text-sm md:text-base text-muted-foreground/80 mt-4 max-w-md mx-auto leading-relaxed animate-fade-in-up">
              Enter your reg. We'll pull the official record, read your photos, and give you a price you can defend.
            </p>
          </div>
        </section>

        {/* Reg input — premium UK plate */}
        <section className="w-full max-w-md mx-auto px-4 sm:px-6 pb-4 relative z-10">
          <div className="relative">
            {/* Plate frame */}
            <div className="flex items-stretch rounded-2xl border-2 border-yellow-400/70 bg-yellow-300 shadow-[0_8px_32px_-12px_hsl(48_100%_50%/0.4)] overflow-hidden transition-all focus-within:border-yellow-500 focus-within:shadow-[0_8px_40px_-8px_hsl(48_100%_50%/0.55)]">
              {/* GB euroband */}
              <div className="hidden sm:flex flex-col items-center justify-center w-9 bg-[#003399] text-white border-r-2 border-yellow-400/60 select-none">
                <div className="flex flex-col items-center -mt-0.5 leading-none">
                  <span className="text-[10px]" aria-hidden>★★★★</span>
                  <span className="text-[8px]" aria-hidden>★&nbsp;&nbsp;★</span>
                  <span className="text-[8px]" aria-hidden>★★★★</span>
                </div>
                <span className="text-[10px] font-bold tracking-wider mt-1">GB</span>
              </div>

              <Input
                id="reg-main"
                aria-label="Vehicle registration number"
                autoComplete="off"
                value={reg}
                onChange={(e) => { setReg(e.target.value.toUpperCase()); setLookupError(null); }}
                placeholder="AB12 CDE"
                maxLength={10}
                disabled={looking}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } }}
                className={cn(
                  "h-14 flex-1 text-center text-xl sm:text-2xl font-bold tracking-[0.22em] uppercase",
                  "bg-yellow-300 text-black border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                  "rounded-none placeholder:text-black/25 placeholder:tracking-[0.12em] placeholder:font-semibold",
                )}
                style={{ fontFamily: "'Charles Wright', ui-monospace, monospace" }}
              />
            </div>

            <button
              type="button"
              onClick={handleLookup}
              disabled={looking || reg.replace(/\s/g, "").length < 2}
              className={cn(
                "mt-3 w-full h-12 rounded-xl bg-primary hover:bg-primary/90 grid place-items-center transition-all duration-200",
                "disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_6px_24px_-8px_hsl(var(--primary)/0.55)]",
                "text-primary-foreground font-semibold text-sm group",
              )}
              aria-label="Lookup registration"
            >
              {looking ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {LOOKUP_STAGES[lookupStage]}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Look up vehicle
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </div>

          {guestLimit && !user && !showVehicleStep && <div className="mt-3"><GuestLimitCard message={guestLimit} reg={normaliseReg(reg)} /></div>}

          {lookupError && (
            <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-foreground/90">
              {lookupError}{" "}
              <button type="button" className="underline underline-offset-2 text-primary" onClick={handleManualEntry}>Enter details manually</button>
            </div>
          )}

          {/* Trust micro-strip */}
          <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground/70">
            <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-border/40 bg-card/30">
              <Database className="h-3.5 w-3.5 text-primary/70" />
              <span className="font-medium text-foreground/80">DVSA data</span>
              <span className="text-[9px] uppercase tracking-wider">Official</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-border/40 bg-card/30">
              <Clock className="h-3.5 w-3.5 text-primary/70" />
              <span className="font-medium text-foreground/80">~30 sec</span>
              <span className="text-[9px] uppercase tracking-wider">Full report</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border border-border/40 bg-card/30">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
              <span className="font-medium text-foreground/80">No upsells</span>
              <span className="text-[9px] uppercase tracking-wider">Honest price</span>
            </div>
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors hover:underline underline-offset-4"
              onClick={handleManualEntry}
            >
              Don't have your reg? Enter details manually
            </button>
          </div>
        </section>


        {/* Vehicle summary + remaining flow */}
        {showVehicleStep && (
          <section className="container pb-24 max-w-3xl space-y-8 animate-fade-in-up">
            {/* Vehicle summary card */}
            <div className="premium-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{isFoundVehicle(lookup) ? "Vehicle found" : "Your vehicle"}</p>
                    <h2 className="text-lg font-semibold">
                      {make || "—"} {model} {variant && <span className="text-muted-foreground font-normal">· {variant}</span>}
                    </h2>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(v => !v)}>
                    <Pencil className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={resetLookup}>
                    Change
                  </Button>
                </div>
              </div>

              {!editing ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <SummaryItem label="Year" value={year || "—"} />
                  <SummaryItem label="Fuel" value={lookup?.fuelType || "—"} />
                  <SummaryItem label="Colour" value={lookup?.colour || "—"} />
                  <SummaryItem
                    label="MOT"
                    value={lookup?.motExpiry ? new Date(lookup.motExpiry).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—"}
                    statusColor={
                      lookup?.motStatus === "Valid" ? "text-emerald-500"
                      : lookup?.motStatus === "Expired" ? "text-destructive"
                      : undefined
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Make" value={make} onChange={setMake} error={errors.make} placeholder="e.g. BMW" />
                  <Field label="Model" value={model} onChange={setModel} error={errors.model} placeholder="e.g. 3 Series" />
                  <Field label="Variant / Trim" value={variant} onChange={setVariant} placeholder="e.g. M Sport 320d" optional />
                  <Field label="Year" value={year} onChange={setYear} error={errors.year} placeholder="2019" type="number" />
                </div>
              )}

              {!editing && (
                <div className="mt-5 pt-5 border-t border-border/40 space-y-2">
                  <Label htmlFor="variant">Trim / version <span className="text-muted-foreground font-normal">(optional, but it can change the value a lot)</span></Label>
                  <Input
                    id="variant" className="h-11" maxLength={60} autoComplete="off"
                    placeholder="e.g. Renaultsport 200, ST-2, GTI, M Sport, AMG"
                    value={variant} onChange={(e) => { setVariant(e.target.value); setTrimAuto(false); }}
                  />
                  {trimHint ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="trim-hint">
                      <span className="text-muted-foreground">
                        {trimHint.confident || trimHint.allPerf
                          ? trimHint.options.length === 1
                            ? `The ${trimHint.reason} was only sold as the ${trimHint.options[0]}.`
                            : `The ${trimHint.reason} was only sold as a performance version. Which is yours?`
                          : `The ${trimHint.reason} is often a performance version. Is yours one of these?`}
                      </span>
                      {[...trimHint.options, ...(trimHint.confident || trimHint.allPerf ? [] : ["Neither"])].map((o) => {
                        const value = o === "Neither" ? "" : o;
                        const active = o === "Neither" ? !variant : variant === o;
                        return (
                          <button
                            key={o} type="button" aria-pressed={active}
                            onClick={() => { setVariant(value); setTrimAuto(false); }}
                            className={cn(
                              "rounded-full border px-3 py-1 min-h-[32px] transition-colors",
                              active ? "border-primary bg-primary/15 text-foreground" : "border-border/60 text-muted-foreground hover:border-primary/60",
                            )}
                          >{o}</button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">DVLA records don't include the trim. Performance versions (RS, ST, GTI, R, AMG, M, vRS, Type R…) are worth much more, so add yours.</p>
                  )}
                  {trimAuto && <p className="text-[11px] text-muted-foreground">Filled in from the engine size. Change it if it's wrong.</p>}
                </div>
              )}

              {lookup?.motSummary && !editing && (
                <div className="mt-5 pt-5 border-t border-border/40 flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>{lookup.motSummary}</span>
                </div>
              )}
              {lookup?.recentAdvisories && lookup.recentAdvisories.length > 0 && !editing && (
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <span>Latest advisories: {lookup.recentAdvisories.join(" · ")}</span>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="space-y-8">
              {/* Mileage + extras */}
              <div className="premium-card p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Add the details only you know</h2>
                  <p className="text-sm text-muted-foreground mt-1">Mileage and history have a big impact on value.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="mileage">Current mileage</Label>
                    <Input
                      id="mileage" type="number" inputMode="numeric"
                      placeholder="e.g. 64,500" className="h-11"
                      value={mileage} onChange={(e) => setMileage(e.target.value)}
                      aria-invalid={!!errors.mileage}
                    />
                    {errors.mileage && <p className="text-xs text-destructive">{errors.mileage}</p>}
                    {lookup?.lastMileage ? (
                      <p className="text-[11px] text-muted-foreground">
                        Last MOT recorded {lookup.lastMileage.toLocaleString()} mi
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mods">Modifications / extras <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="mods" className="h-11"
                      placeholder="e.g. Pano roof, remap, new tyres"
                      value={modifications} onChange={(e) => setModifications(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="notes">Service history notes</Label>
                    <Textarea
                      id="notes" rows={3} maxLength={500}
                      placeholder="e.g. Full main-dealer service history, cambelt at 60k, 4 new tyres last summer."
                      value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="premium-card p-6 sm:p-8">
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </div>

              {/* Submit */}
              <Turnstile key={tsKey} onToken={setTsToken} action="analyse" />
              {guestLimit && !user && <GuestLimitCard message={guestLimit} reg={lookup?.registration || normaliseReg(reg)} />}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <p className="text-xs text-muted-foreground max-w-md">
                  We'll combine your reg lookup, details and photos to generate a realistic private sale price.
                  {!user && <span className="block mt-1 text-muted-foreground/70">No account needed. Free for up to {GUEST_DAILY_CAP} valuations a day.</span>}
                </p>
                <Button type="submit" variant="hero" size="xl" disabled={busy || (turnstileEnabled() && !tsToken)}>
                  {busy ? "Working…" : <>Get my valuation <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </form>
          </section>
        )}
      </main>
      <Footer />
      <UploadProgressModal open={busy} phase={phase} uploadProgress={uploadProgress} />
    </div>
  );
}

function GuestLimitCard({ message, reg }: { message: string; reg?: string }) {
  const remember = () => {
    try {
      if (reg) sessionStorage.setItem("valu8_pending_intent", JSON.stringify({ kind: "lookup", reg }));
    } catch { /* storage unavailable */ }
  };
  return (
    <div role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <p className="text-sm font-medium text-foreground">You've used today's free guest valuations</p>
      <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{message}</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Button asChild variant="hero" size="sm" className="min-h-[44px]">
          <Link to="/auth?mode=signup" onClick={remember}>Create a free account</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
          <Link to="/auth" onClick={remember}>I already have one</Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, statusColor }: { label: string; value: string; statusColor?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-sm font-medium", statusColor)}>{value}</p>
    </div>
  );
}

function Field({
  label, value, onChange, error, placeholder, type, optional,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; placeholder?: string; type?: string; optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}{optional && <span className="text-muted-foreground font-normal"> (optional)</span>}</Label>
      <Input
        className="h-11" type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
