import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header, TestModeBanner } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CAR_MAKES, YEARS } from "@/lib/cars";
import { getModelsForMake } from "@/lib/models";
import { getVariantsFor } from "@/lib/variants";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { UploadProgressModal, type UploadPhase } from "@/components/UploadProgressModal";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

const formSchema = z.object({
  make: z.string().min(1, "Select a make"),
  model: z.string().trim().min(1, "Enter a model").max(60),
  variant: z.string().trim().max(80).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1950).max(2026),
  mileage: z.coerce.number().int().min(0).max(500000),
  registration: z.string().trim().max(10).optional().or(z.literal("")),
  motExpiry: z.string().optional().or(z.literal("")),
  serviceNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

export default function NewValuation() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "New valuation — Valu8"; }, []);

  const filteredMakes = CAR_MAKES.filter(m => m.toLowerCase().includes(makeQuery.toLowerCase()));
  const availableModels = getModelsForMake(make);
  const filteredModels = availableModels.filter(m => m.toLowerCase().includes(modelQuery.toLowerCase()));
  const availableVariants = getVariantsFor(make, model);
  const filteredVariants = availableVariants.filter(v => v.toLowerCase().includes(variantQuery.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate("/auth");

    const parsed = formSchema.safeParse({ make, model, variant, year, mileage, registration, motExpiry, serviceNotes });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});

    setBusy(true);
    setPhase("uploading");
    setUploadProgress(photos.length === 0 ? 100 : 0);
    try {
      // Upload photos with real progress
      const photoUrls: string[] = [];
      const total = photos.length;
      for (let i = 0; i < total; i++) {
        const p = photos[i];
        const ext = p.file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
          contentType: p.file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
        photoUrls.push(data.publicUrl);
        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      setPhase("analysing");
      // Call AI analysis edge function
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("analyse-vehicle", {
        body: {
          make: parsed.data.make,
          model: parsed.data.model,
          variant: parsed.data.variant || undefined,
          year: parsed.data.year,
          mileage: parsed.data.mileage,
          registration: parsed.data.registration || undefined,
          motExpiry: parsed.data.motExpiry || undefined,
          serviceNotes: parsed.data.serviceNotes || undefined,
          photoUrls,
        },
      });
      if (aiErr) throw aiErr;
      const report = (aiData as any)?.report;
      if (!report) throw new Error("AI did not return a report");

      setPhase("generating");
      const { data, error } = await supabase.from("valuations").insert({
        user_id: user.id,
        make: parsed.data.make,
        model: parsed.data.variant ? `${parsed.data.model} · ${parsed.data.variant}` : parsed.data.model,
        year: parsed.data.year,
        mileage: parsed.data.mileage,
        registration: parsed.data.registration || null,
        mot_expiry: parsed.data.motExpiry || null,
        service_notes: parsed.data.serviceNotes || null,
        photo_urls: photoUrls,
        condition_score: report.conditionScore,
        private_value: report.values.privateSale,
        report: report as any,
      }).select("id").single();
      if (error) throw error;

      setPhase("done");
      // brief flourish then jump straight to report
      setTimeout(() => navigate(`/valuation/${data.id}`), 600);
    } catch (err: any) {
      toast.error(err.message || "Failed to create valuation");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="container pt-20 pb-16 md:pt-32 md:pb-24 text-center max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-10 animate-fade-in-up">
              Trusted by thousands of UK private sellers
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-gradient leading-[1.08] animate-fade-in-up">
              Know your car's true worth<br className="hidden sm:block" /> before you sell
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-8 max-w-xl mx-auto leading-relaxed animate-fade-in-up">
              Honest valuations built on live UK market data. No inflated dealer prices, no guesswork. Just the realistic figure you can expect in a private sale.
            </p>
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-sm text-muted-foreground/80 animate-fade-in-up">
              <span className="flex items-center gap-2.5">
                <span className="h-[5px] w-[5px] rounded-full bg-primary/60" />
                Full condition assessment
              </span>
              <span className="flex items-center gap-2.5">
                <span className="h-[5px] w-[5px] rounded-full bg-primary/60" />
                MOT & market summary
              </span>
              <span className="flex items-center gap-2.5">
                <span className="h-[5px] w-[5px] rounded-full bg-primary/60" />
                Realistic private sale price
              </span>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="container pb-24 max-w-4xl">
          <form onSubmit={submit} className="premium-card p-6 sm:p-10 space-y-10">
            <div>
              <h2 className="text-xl font-semibold">Vehicle details</h2>
              <p className="text-sm text-muted-foreground mt-1">A few essentials to anchor the valuation.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                <div className="space-y-2">
                  <Label>Make</Label>
                  <Select value={make} onValueChange={(v) => { setMake(v); setModel(""); setModelQuery(""); setVariant(""); setVariantQuery(""); }}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                    <SelectContent>
                      <div className="p-2 sticky top-0 bg-popover z-10">
                        <Input
                          placeholder="Search 130+ manufacturers"
                          value={makeQuery}
                          onChange={(e) => setMakeQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-10"
                        />
                      </div>
                      {filteredMakes.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                      {filteredMakes.length === 0 && (
                        <div className="px-3 py-6 text-sm text-muted-foreground text-center">No matches</div>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.make && <p className="text-xs text-destructive">{errors.make}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  {availableModels.length > 0 ? (
                    <Select value={model} onValueChange={(v) => { setModel(v); setVariant(""); setVariantQuery(""); }}>
                      <SelectTrigger className="h-10"><SelectValue placeholder={make ? "Select model" : "Pick a make first"} /></SelectTrigger>
                      <SelectContent>
                        <div className="p-2 sticky top-0 bg-popover z-10">
                          <Input
                            placeholder={`Search ${make} models`}
                            value={modelQuery}
                            onChange={(e) => setModelQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-10"
                          />
                        </div>
                        {filteredModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                        {filteredModels.length === 0 && modelQuery && (
                          <SelectItem value={modelQuery.trim()}>Use "{modelQuery.trim()}"</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-10" placeholder={make ? "e.g. 3 Series" : "Pick a make first"} value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} />
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label>Variant / Engine / Trim <span className="text-muted-foreground font-normal">(optional but recommended)</span></Label>
                  {availableVariants.length > 0 ? (
                    <>
                      <Select value={variant} onValueChange={setVariant}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={`Choose a ${model || make} variant…`} />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2 sticky top-0 bg-popover z-10">
                            <Input
                              placeholder="Search or type your own"
                              value={variantQuery}
                              onChange={(e) => setVariantQuery(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="h-10"
                            />
                          </div>
                          {filteredVariants.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                          {variantQuery.trim() && !filteredVariants.some(v => v.toLowerCase() === variantQuery.trim().toLowerCase()) && (
                            <SelectItem value={variantQuery.trim()}>Use "{variantQuery.trim()}"</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {availableVariants.slice(0, 6).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVariant(v)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                              variant === v
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Input
                      className="h-10"
                      placeholder={make ? "e.g. RS 200 Mk3, 3.0 V6 Twin Turbo, Classic Spec…" : "Pick a make first"}
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                      disabled={!make}
                      maxLength={80}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input id="mileage" className="h-10" type="number" inputMode="numeric" placeholder="e.g. 64,500" value={mileage} onChange={(e) => setMileage(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg">UK Registration</Label>
                  <Input id="reg" className="h-10" placeholder="AB12 CDE" value={registration} onChange={(e) => setRegistration(e.target.value.toUpperCase())} maxLength={10} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mot">MOT expiry</Label>
                  <Input id="mot" className="h-10" type="date" value={motExpiry} onChange={(e) => setMotExpiry(e.target.value)} />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Service history notes</Label>
                  <Textarea id="notes" rows={3} maxLength={500}
                    placeholder="e.g. Full main-dealer service history, cambelt done at 60k, 4 new tyres last summer."
                    value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <PhotoUploader photos={photos} onChange={setPhotos} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground max-w-md">
                Test mode is free. Your valuation will be saved to your dashboard.
              </p>
              <Button type="submit" variant="hero" size="xl" disabled={busy}>
                {busy ? "Uploading…" : <>Get my valuation <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
      <UploadProgressModal open={busy} phase={phase} uploadProgress={uploadProgress} />
    </div>
  );
}
