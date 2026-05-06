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
import { getVariantsForMake } from "@/lib/variants";
import { PhotoUploader, PhotoFile } from "@/components/PhotoUploader";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { Sparkles, ArrowRight, ShieldCheck, Zap, TrendingUp } from "lucide-react";

const formSchema = z.object({
  make: z.string().min(1, "Select a make"),
  model: z.string().trim().min(1, "Enter a model").max(60),
  variant: z.string().trim().max(80).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1995).max(2026),
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

  useEffect(() => { document.title = "New valuation — Valu8"; }, []);

  const filteredMakes = CAR_MAKES.filter(m => m.toLowerCase().includes(makeQuery.toLowerCase()));
  const availableModels = getModelsForMake(make);
  const filteredModels = availableModels.filter(m => m.toLowerCase().includes(modelQuery.toLowerCase()));
  const availableVariants = getVariantsForMake(make);
  const filteredVariants = availableVariants.filter(v => v.toLowerCase().includes(variantQuery.toLowerCase()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate("/auth");

    const parsed = formSchema.safeParse({ make, model, variant, year, mileage, registration, motExpiry, serviceNotes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const p of photos) {
        const ext = p.file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, p.file, {
          contentType: p.file.type, upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
        photoUrls.push(data.publicUrl);
      }

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

      navigate(`/valuation/${data.id}/analysing`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create valuation");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden hero-glow">
          <div className="container py-16 md:py-24 text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6 animate-fade-in-up">
              <Sparkles className="h-3 w-3" /> AI-powered • Built for UK private sellers
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gradient leading-[1.05] animate-fade-in-up">
              Instant AI Car Valuation<br/>
              <span className="text-gradient-primary">for Private Sellers</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-xl mx-auto animate-fade-in-up">
              Honest market value. Condition-aware. Built around the price you'll actually achieve in a private sale — not a forecourt trade-in.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground animate-fade-in-up">
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> 60-second analysis</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> HPI &amp; MOT summary</span>
              <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" /> Three-tier value range</span>
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
                  <Select value={make} onValueChange={(v) => { setMake(v); setModel(""); setModelQuery(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                    <SelectContent>
                      <div className="p-2 sticky top-0 bg-popover z-10">
                        <Input
                          placeholder="Search 50+ manufacturers"
                          value={makeQuery}
                          onChange={(e) => setMakeQuery(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-9"
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
                </div>

                <div className="space-y-2">
                  <Label>Model</Label>
                  {availableModels.length > 0 ? (
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger><SelectValue placeholder={make ? "Select model" : "Pick a make first"} /></SelectTrigger>
                      <SelectContent>
                        <div className="p-2 sticky top-0 bg-popover z-10">
                          <Input
                            placeholder={`Search ${make} models`}
                            value={modelQuery}
                            onChange={(e) => setModelQuery(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-9"
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
                    <Input placeholder={make ? "e.g. 3 Series" : "Pick a make first"} value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} />
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
                  <Input id="mileage" type="number" inputMode="numeric" placeholder="e.g. 64,500" value={mileage} onChange={(e) => setMileage(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg">UK Registration</Label>
                  <Input id="reg" placeholder="AB12 CDE" value={registration} onChange={(e) => setRegistration(e.target.value.toUpperCase())} maxLength={10} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mot">MOT expiry</Label>
                  <Input id="mot" type="date" value={motExpiry} onChange={(e) => setMotExpiry(e.target.value)} />
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
              <div className="flex items-end justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-semibold">Photos</h2>
                  <p className="text-sm text-muted-foreground mt-1">Six quick shots = a sharper valuation. You can submit with fewer.</p>
                </div>
                <span className="text-xs text-primary font-medium">Recommended for best results</span>
              </div>
              <div className="mt-6">
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </div>
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
    </div>
  );
}
