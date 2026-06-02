import { useEffect, useState } from "react";
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
import { CAR_MAKES, YEARS } from "@/lib/cars";
import { getModelsForMake } from "@/lib/models";
import { getVariantsFor } from "@/lib/variants";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Save, Crown, X } from "lucide-react";

export default function EditValuation() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { loading: pLoading } = useProfile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
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
      setMake(data.make ?? "");
      const rawModel = String(data.model ?? "");
      const [baseModel, ...rest] = rawModel.split(" · ");
      setModel(baseModel ?? "");
      setVariant(rest.join(" · "));
      setYear(String(data.year ?? ""));
      setMileage(String(data.mileage ?? ""));
      setRegistration(data.registration ?? "");
      setMotExpiry(data.mot_expiry ?? "");
      setServiceNotes(data.service_notes ?? "");
      setExistingPhotos(Array.isArray(data.photo_urls) ? (data.photo_urls as unknown as string[]) : []);
      setLoading(false);
    })();
  }, [id, user, navigate]);

  async function uploadNewPhotos(): Promise<string[]> {
    if (!user) return [];
    const urls: string[] = [];
    for (const p of newPhotos) {
      const ext = p.file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
        contentType: p.file.type, upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
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
    try {
      const newUrls = await uploadNewPhotos();
      const allPhotos = [...existingPhotos, ...newUrls];

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

      const { data: aiData, error: aiErr } = await supabase.functions.invoke("analyse-vehicle", {
        body: {
          make: make || row.make,
          model: model || row.model.split(" · ")[0],
          variant: variant.trim() || undefined,
          year: Number(year) || row.year,
          mileage: Number(mileage) || row.mileage,
          registration: registration || undefined,
          motExpiry: motExpiry || undefined,
          serviceNotes: serviceNotes || undefined,
          photoUrls: allPhotos,
        },
      });
      if (aiErr) throw aiErr;
      if ((aiData as any)?.error) throw new Error((aiData as any).error);
      const report = (aiData as any)?.report;
      if (!report) throw new Error("AI did not return a report — please try again in a moment");


      const updatedReport = {
        ...report,
        edited: true,
        lastEditedAt: new Date().toISOString(),
        previousVersions: [snapshot, ...previousVersions].slice(0, 10),
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
      toast.error(e.message || "Regeneration failed");
    } finally { setRegenerating(false); }
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
      <main className="flex-1 container py-8 md:py-12 max-w-4xl">
        <Link to={`/valuation/${row.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to report
        </Link>

        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary mb-2">
              <Crown className="h-3 w-3" /> Premium edit mode
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Edit valuation</h1>
            <p className="text-muted-foreground mt-1">{row.year} {row.make} {row.model}</p>
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
                {existingPhotos.map((url, i) => (
                  <div key={url} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setExistingPhotos(p => p.filter(u => u !== url))}
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground max-w-sm">
              Saving keeps the current report. Regenerating creates a fresh AI report and keeps the original in history.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={saveOnly} disabled={busy || regenerating}>
                <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="hero" onClick={regenerate} disabled={busy || regenerating}>
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
