import { useEffect, useState } from "react";
import { displayMake, displayModel } from "../../supabase/functions/_shared/vehicle-text";
import { Turnstile, turnstileEnabled, turnstileHeaders } from "@/components/Turnstile";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAR_MAKES, YEARS, matchOption } from "@/lib/cars";
import { getModelsForMake } from "@/lib/models";
import { getVariantsFor } from "@/lib/variants";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Save, Crown, X, Pencil } from "lucide-react";
import { BILLING_ENABLED } from "@/lib/billing";
import { signPhotoUrls, extractPhotoPath } from "@/lib/photos";

type InputSnapshot = {
  make: string; model: string; variant?: string; year: number; mileage: number;
  registration?: string; motExpiry?: string; serviceNotes?: string; photoRefs: string[];
};
function describeInputChanges(prev: InputSnapshot, next: InputSnapshot): string[] {
  const out: string[] = [];
  const norm = (s: any) => (s ?? "").toString().trim().toLowerCase();
  if (norm(prev.make) !== norm(next.make)) out.push("the make changed");
  if (norm(prev.model) !== norm(next.model)) out.push("the model changed");
  if (norm(prev.variant) !== norm(next.variant)) out.push("the variant changed");
  if (Number(prev.year) !== Number(next.year)) out.push("the year changed");
  if (Number(prev.mileage) !== Number(next.mileage)) out.push("the mileage changed");
  if (norm(prev.registration) !== norm(next.registration)) out.push("the registration changed");
  if (norm(prev.motExpiry) !== norm(next.motExpiry)) out.push("the MOT expiry changed");
  if (norm(prev.serviceNotes) !== norm(next.serviceNotes)) out.push("the service notes changed");
  const a = [...(prev.photoRefs ?? [])].map((p) => extractPhotoPath(p) ?? p).sort();
  const b = [...(next.photoRefs ?? [])].map((p) => extractPhotoPath(p) ?? p).sort();
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) out.push("the photos changed");
  return out;
}

const REGEN_TIMEOUT_MS = 90_000;

export default function EditValuation() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsKey, setTsKey] = useState(0);
  const { loading: pLoading } = useProfile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenElapsed, setRegenElapsed] = useState(0);
  const [regenError, setRegenError] = useState<string | null>(null);
  useEffect(() => {
    if (!regenerating) { setRegenElapsed(0); return; }
    const t0 = Date.now();
    const iv = window.setInterval(() => setRegenElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [regenerating]);
  const [row, setRow] = useState<any>(null);

  const [make, setMake] = useState("");
  const [makeQuery, setMakeQuery] = useState("");
  const [model, setModel] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [variant, setVariant] = useState("");
  const [variantQuery, setVariantQuery] = useState("");
  const [year, setYear] = useState<string>("");
  const [mileage, setMileage] = useState("");
  const [registration, setRegistration] = useState("");
  const [motExpiry, setMotExpiry] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [existingPhotoPreviews, setExistingPhotoPreviews] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);

  const filteredMakes = CAR_MAKES.filter(m => m.toLowerCase().includes(makeQuery.toLowerCase()));
  const availableModels = getModelsForMake(make);
  const filteredModels = availableModels.filter(m => m.toLowerCase().includes(modelQuery.toLowerCase()));
  const availableVariants = getVariantsFor(make, model);
  const filteredVariants = availableVariants.filter(v => v.toLowerCase().includes(variantQuery.toLowerCase()));

  useEffect(() => { document.title = "Edit valuation — Valu8"; }, []);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data, error } = await supabase.from("valuations").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Valuation not found"); navigate("/dashboard"); return; }
      setRow(data);
      const canonMake = matchOption(data.make, CAR_MAKES);
      setMake(canonMake);
      const rawModel = String(data.model ?? "");
      const [baseModel, ...rest] = rawModel.split(" · ");
      setModel(matchOption(baseModel, getModelsForMake(canonMake)));
      setVariant(rest.join(" · "));
      setYear(String(data.year ?? ""));
      setMileage(String(data.mileage ?? ""));
      setRegistration(data.registration ?? "");
      setMotExpiry(data.mot_expiry ?? "");
      setServiceNotes(data.service_notes ?? "");
      const photos = Array.isArray(data.photo_urls) ? (data.photo_urls as unknown as string[]) : [];
      setExistingPhotos(photos);
      setExistingPhotoPreviews(await signPhotoUrls(photos));
      setLoading(false);
    })();
  }, [id, user, navigate]);

  async function uploadNewPhotos(): Promise<string[]> {
    if (!user) return [];
    const paths: string[] = [];
    for (const p of newPhotos) {
      const ext = p.file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
        contentType: p.file.type, upsert: false,
      });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  }

  const composedModel = variant.trim() ? `${model} · ${variant.trim()}` : model;

  async function saveOnly() {
    if (!row) return;
    setBusy(true);
    try {
      const newUrls = await uploadNewPhotos();
      const allPhotos = [...existingPhotos, ...newUrls];
      const updatedReport = { ...(row.report || {}), edited: true, lastEditedAt: new Date().toISOString() };
      const { error } = await supabase.from("valuations").update({
        make: make || row.make,
        model: composedModel || row.model,
        year: Number(year) || row.year,
        mileage: Number(mileage) || row.mileage,
        registration: registration || null,
        mot_expiry: motExpiry || null,
        service_notes: serviceNotes || null,
        photo_urls: allPhotos,
        report: updatedReport,
      }).eq("id", row.id);
      if (error) throw error;
      toast.success("Changes saved");
      navigate(`/valuation/${row.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setBusy(false); }
  }

  async function regenerate() {
    if (!row || !user) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const newUrls = await uploadNewPhotos();
      const allPhotos = [...existingPhotos, ...newUrls];

      // ---- Input-change detection ----------------------------------------
      // Same inputs => same report. We don't burn AI credits or risk drift
      // from the live market sample when nothing about the car changed.
      const nextInputs = {
        make: make || row.make,
        model: composedModel || row.model,
        variant: variant.trim() || undefined,
        year: Number(year) || row.year,
        mileage: Number(mileage) || row.mileage,
        registration: registration || undefined,
        motExpiry: motExpiry || undefined,
        serviceNotes: serviceNotes || undefined,
        photoRefs: allPhotos,
      };
      const prevInputs = {
        make: row.make,
        model: row.model,
        variant: undefined as string | undefined,
        year: row.year,
        mileage: row.mileage,
        registration: row.registration ?? undefined,
        motExpiry: row.mot_expiry ?? undefined,
        serviceNotes: row.service_notes ?? undefined,
        photoRefs: Array.isArray(row.photo_urls) ? (row.photo_urls as string[]) : [],
      };
      const changes = describeInputChanges(prevInputs, nextInputs);
      if (changes.length === 0) {
        toast.info("No changes made. Edit a detail or add photos to regenerate.");
        setRegenerating(false);
        return;
      }

      const previousVersions = Array.isArray(row.report?.previousVersions) ? row.report.previousVersions : [];
      const snapshot = {
        savedAt: new Date().toISOString(),
        make: row.make,
        model: row.model,
        year: row.year,
        mileage: row.mileage,
        registration: row.registration,
        motExpiry: row.mot_expiry,
        serviceNotes: row.service_notes,
        photoUrls: row.photo_urls,
        report: { ...row.report, previousVersions: undefined },
      };

      // Hard client-side timeout so the page never hangs on a stuck request.
      let timer: number | undefined;
      const timeout = new Promise<never>((_, rej) => {
        timer = window.setTimeout(() => rej(new Error("This is taking longer than expected. Your edits are not lost — please try again.")), REGEN_TIMEOUT_MS);
      });
      const { data: aiData, error: aiErr } = await Promise.race([supabase.functions.invoke("analyse-vehicle", {
        body: {
          make: nextInputs.make,
          model: model || row.model.split(" · ")[0],
          variant: nextInputs.variant,
          year: nextInputs.year,
          mileage: nextInputs.mileage,
          registration: nextInputs.registration,
          motExpiry: nextInputs.motExpiry,
          serviceNotes: nextInputs.serviceNotes,
          photoUrls: allPhotos,
        },
        headers: turnstileHeaders(tsToken),
      }), timeout]).finally(() => clearTimeout(timer));
      if (aiErr) {
        // Surface the real server message (e.g. daily limit reached) instead of
        // supabase-js's generic "non-2xx status code".
        let msg = aiErr.message || "Regeneration failed";
        try { const j = await (aiErr as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((aiData as any)?.error) throw new Error((aiData as any).error);
      const report = (aiData as any)?.report;
      if (!report) throw new Error("AI did not return a report — please try again in a moment");


      const updatedReport = {
        ...report,
        edited: true,
        lastEditedAt: new Date().toISOString(),
        regenerationReason: `Refreshed because ${changes.join(", ")}.`,
        previousVersions: [snapshot, ...previousVersions].slice(0, 10),
        // Keep the owner's recorded sale price across regenerations.
        ...(row.report?.saleFeedback ? { saleFeedback: row.report.saleFeedback } : {}),
      };

      const { error } = await supabase.from("valuations").update({
        make: make || row.make,
        model: composedModel || row.model,
        year: Number(year) || row.year,
        mileage: Number(mileage) || row.mileage,
        registration: registration || null,
        mot_expiry: motExpiry || null,
        service_notes: serviceNotes || null,
        photo_urls: allPhotos,
        condition_score: report.conditionScore,
        private_value: report.valuationUnavailable ? null : report.values.privateSale,
        report: updatedReport,
      }).eq("id", row.id);
      if (error) throw error;

      toast.success("Report regenerated — original kept in history");
      navigate(`/valuation/${row.id}`);
    } catch (e: any) {
      const msg = e?.message || "Regeneration failed";
      setRegenError(msg);
      toast.error(msg);
    } finally {
      // Turnstile tokens are single-use: always reset so a retry gets a fresh one.
      setTsToken(null); setTsKey((k) => k + 1);
      setRegenerating(false);
    }
  }

  if (loading || pLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container py-8 md:py-12 max-w-4xl">
        <Link to={`/valuation/${row.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to report
        </Link>

        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary mb-2">
              {BILLING_ENABLED ? <><Crown className="h-3 w-3" aria-hidden /> Premium edit mode</> : <><Pencil className="h-3 w-3" aria-hidden /> Edit mode</>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit valuation</h1>
            <p className="text-muted-foreground mt-1">{row.year} {displayMake(row.make)} {displayModel(row.make, row.model)}</p>
          </div>
        </div>

        <div className="premium-card p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Make</Label>
              <Select value={make} onValueChange={(v) => { setMake(v); setModel(""); setVariant(""); }}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-popover z-10">
                    <Input placeholder="Search makes" value={makeQuery} onChange={(e) => setMakeQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-9" />
                  </div>
                  {make && !CAR_MAKES.includes(make) && <SelectItem value={make}>{make}</SelectItem>}
                  {filteredMakes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              {availableModels.length > 0 ? (
                <Select value={model} onValueChange={(v) => { setModel(v); setVariant(""); }}>
                  <SelectTrigger><SelectValue placeholder={make ? "Select model" : "Pick a make first"} /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover z-10">
                      <Input placeholder={`Search ${make} models`} value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-9" />
                    </div>
                    {model && !availableModels.includes(model) && <SelectItem value={model}>{model}</SelectItem>}
                    {filteredModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    {filteredModels.length === 0 && modelQuery && (
                      <SelectItem value={modelQuery.trim()}>Use "{modelQuery.trim()}"</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} />
              )}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Variant / Engine / Trim <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {availableVariants.length > 0 ? (
                <Select value={variant} onValueChange={setVariant}>
                  <SelectTrigger><SelectValue placeholder="Choose a variant…" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2 sticky top-0 bg-popover z-10">
                      <Input placeholder="Search or type your own" value={variantQuery} onChange={(e) => setVariantQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-9" />
                    </div>
                    {filteredVariants.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    {variantQuery.trim() && !filteredVariants.some(v => v.toLowerCase() === variantQuery.trim().toLowerCase()) && (
                      <SelectItem value={variantQuery.trim()}>Use "{variantQuery.trim()}"</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={variant} onChange={(e) => setVariant(e.target.value)} disabled={!make} maxLength={80}
                  placeholder="e.g. RS 200 Mk3, 3.0 V6 Twin Turbo…" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileage">Mileage</Label>
              <Input id="mileage" type="number" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg">UK Registration</Label>
              <Input id="reg" value={registration} onChange={(e) => setRegistration(e.target.value.toUpperCase())} maxLength={10} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mot">MOT expiry</Label>
              <Input id="mot" type="date" value={motExpiry} onChange={(e) => setMotExpiry(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Service history & spec notes</Label>
              <Textarea id="notes" rows={4} maxLength={500} value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)}
                placeholder="Add new service, options, modifications, recent receipts…" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Existing photos</h3>
            {existingPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos on this valuation yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {existingPhotos.map((ref, i) => (
                  <div key={ref} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border">
                    <img src={existingPhotoPreviews[i] || ""} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setExistingPhotos(p => p.filter((u) => u !== ref));
                        setExistingPhotoPreviews(p => p.filter((_, idx) => existingPhotos[idx] !== ref));
                      }}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Add new photos</h3>
            <PhotoUploader photos={newPhotos} onChange={setNewPhotos} />
          </div>

          <Turnstile key={tsKey} onToken={setTsToken} action="regenerate" />
          {regenerating && (
            <div role="status" aria-live="polite" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              {regenElapsed < 8 ? "Re-reading your vehicle details and MOT history…"
                : regenElapsed < 20 ? "Analysing photos and computing your updated valuation…"
                : regenElapsed < 40 ? "Building your refreshed report — almost there…"
                : "Still working — this is slower than usual. We'll stop and let you retry if it doesn't finish soon."}
              <span className="ml-2 text-muted-foreground tabular-nums">{regenElapsed}s</span>
            </div>
          )}
          {!regenerating && regenError && (
            <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <span>Couldn't regenerate the report: {regenError}</span>
              <Button size="sm" variant="outline" onClick={regenerate} disabled={turnstileEnabled() && !tsToken}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground max-w-sm">
              Saving keeps the current report. Regenerating creates a fresh AI report and keeps the original in history.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={saveOnly} disabled={busy || regenerating}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="hero" onClick={regenerate} disabled={busy || regenerating || (turnstileEnabled() && !tsToken)}>
                <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Regenerating…" : "Regenerate report"}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
