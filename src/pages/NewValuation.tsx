import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { useAuth } from "@/contexts/AuthContext";
import { Header, TestModeBanner } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { UploadProgressModal, type UploadPhase } from "@/components/UploadProgressModal";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import {
  ArrowRight, Search, Loader2, CheckCircle2, Pencil, AlertCircle, Car,
  ShieldCheck, Sparkles, Clock, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LookupResult {
  registration: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  colour?: string;
  motExpiry?: string;
  motStatus?: "Valid" | "Expired" | "Unknown";
  motSummary?: string;
  lastMileage?: number;
  recentAdvisories?: string[];
}

const finalSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1950).max(2026),
  mileage: z.coerce.number().int().min(0).max(500000),
});

export default function NewValuation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Lookup state
  const [reg, setReg] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [editing, setEditing] = useState(false);

  // Editable vehicle fields (populated by lookup, overridable)
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
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

  useEffect(() => { document.title = "New valuation — Valu8"; }, []);

  async function handleLookup() {
    const cleaned = reg.replace(/\s+/g, "").toUpperCase();
    if (cleaned.length < 2) {
      toast.error("Enter a valid UK registration");
      return;
    }
    setLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-vehicle", {
        body: { registration: cleaned },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as LookupResult;
      setLookup(result);
      setMake(result.make ?? "");
      setModel(result.model ?? "");
      setYear(result.year ? String(result.year) : "");
      setVariant("");
      if (result.lastMileage && !mileage) setMileage(String(result.lastMileage));
      toast.success("Vehicle found");
    } catch (err: any) {
      toast.error(err.message || "Lookup failed — you can enter details manually");
      // Allow manual entry path
      setLookup({ registration: cleaned });
      setEditing(true);
    } finally {
      setLooking(false);
    }
  }

  function resetLookup() {
    setLookup(null);
    setEditing(false);
    setMake(""); setModel(""); setVariant(""); setYear("");
    setMileage(""); setServiceNotes(""); setModifications("");
    setPhotos([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate("/auth");

    const parsed = finalSchema.safeParse({ make, model, year, mileage });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "");
        if (k && !fe[k]) fe[k] = i.message || "Required";
      }
      setErrors(fe);
      toast.error("Please complete the highlighted fields");
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
      const photoUrls: string[] = [];
      const photos_labeled: { slot: string; url: string }[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
          contentType: p.file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
        photoUrls.push(data.publicUrl);
        photos_labeled.push({ slot: p.key, url: data.publicUrl });
        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }
      if (photos.length > 0) {
        posthog.capture?.("Photos Uploaded", {
          count: photos.length,
          slots: photos_labeled.map((p) => p.slot),
        });
      }


      setPhase("analysing");
      const combinedNotes = [
        serviceNotes.trim(),
        modifications.trim() ? `Modifications / extras: ${modifications.trim()}` : "",
        lookup?.colour ? `Colour: ${lookup.colour}` : "",
        lookup?.fuelType ? `Fuel: ${lookup.fuelType}` : "",
        lookup?.recentAdvisories?.length ? `Recent MOT advisories: ${lookup.recentAdvisories.join("; ")}` : "",
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
          serviceNotes: combinedNotes || undefined,
          photoUrls,
          photos: photos_labeled,
          userId: user.id,
        },
      });

      if (aiErr) throw aiErr;
      if ((aiData as any)?.error) throw new Error((aiData as any).error);
      const report = (aiData as any)?.report;
      if (!report) throw new Error("AI did not return a report");

      setPhase("generating");
      const { data, error } = await supabase.from("valuations").insert({
        user_id: user.id,
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
        report: report as any,
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

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <section className="relative overflow-hidden w-full">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/10 blur-[120px]" />

          <div className="container relative pt-14 pb-4 md:pt-20 md:pb-8 text-center max-w-2xl mx-auto">
            {/* Eyebrow chip */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary mb-5 animate-fade-in-up">
              <Sparkles className="h-3 w-3" />
              AI-powered · UK private seller valuations
            </div>

            <h1 className="text-[2rem] md:text-[2.85rem] font-semibold tracking-tight text-gradient leading-[1.05] animate-fade-in-up">
              Know exactly what
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
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
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
                  Looking up your vehicle…
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
              onClick={() => { setLookup({ registration: "" }); setEditing(true); }}
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
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vehicle found</p>
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
                    value={lookup?.motExpiry ? new Date(lookup.motExpiry).toLocaleDateString("en-GB") : "—"}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <p className="text-xs text-muted-foreground max-w-md">
                  We'll combine your reg lookup, details and photos to generate a realistic private sale price.
                </p>
                <Button type="submit" variant="hero" size="xl" disabled={busy}>
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
