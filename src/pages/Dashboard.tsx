import { useSeo } from "@/lib/seo";
import { headlinePrivateText } from "../../supabase/functions/_shared/cheapRange";
import { getRouteMeta } from "@/data/routeMeta";
import { vehicleTitle } from "../../supabase/functions/_shared/vehicle-text";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Eye, Car, TrendingUp, Activity, Pencil, Crown, Trash2, Search, ArrowUpDown, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ConfirmDialog";
import { signPhotoUrls } from "@/lib/photos";
import { hasPhotos } from "@/lib/askingPrice";
import { BILLING_ENABLED } from "@/lib/billing";
import { motDue, buildMotIcs, downloadIcs, valueTrends } from "@/lib/retention";
import { SITE_URL } from "@/lib/site";
import { needsSaleFeedbackPrompt } from "@/lib/saleFeedback";
import { HandCoins } from "lucide-react";
import { AdvertFollowupCard } from "@/components/AdvertFollowupCard";
import { CalendarPlus, AlertTriangle, TrendingDown, Minus } from "lucide-react";
import "@/styles/tesla.css";
import { FitPrice } from "@/components/FitPrice";
import { RollingPrice } from "@/components/tesla/parts";
import { bodyKeyFor, carImageSrc } from "@/components/tesla/carImage";
import { renderFor } from "@/components/tesla/modelRenders";
import { gradeFromReport } from "@/lib/carGrade";
import { isPlausibleUkReg, normaliseReg } from "@/lib/registration";


type SortKey = "newest" | "oldest" | "highest" | "lowest";

interface Row {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string | null;
  mot_expiry?: string | null;
  condition_score: number | null;
  private_value: number | null;
  created_at: string;
  photo_urls: any;
  report: any;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isPremium } = useProfile();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [reg, setReg] = useState("");
  const [regErr, setRegErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useSeo(getRouteMeta("/dashboard"));

  useEffect(() => {
    if (!user) return;
    supabase.from("valuations")
      .select("id,make,model,year,mileage,registration,mot_expiry,condition_score,private_value,created_at,photo_urls,report")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data as any[]) || [];
        setRows(list as Row[]);
        setLoading(false);
        // Sign the first photo of each row in one batch for thumbnails.
        const refs = list.map((r) => (Array.isArray(r.photo_urls) ? r.photo_urls[0] : null));
        const signed = await signPhotoUrls(refs);
        const map: Record<string, string> = {};
        list.forEach((r, i) => { if (signed[i]) map[r.id] = signed[i]; });
        setCoverUrls(map);
      });
  }, [user]);

  // Which saved valuations have the paid report (read-only; a failure just shows them as Free).
  useEffect(() => {
    if (!user || rows.length === 0) return;
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.from("report_purchases").select("valuation_id").eq("status", "paid").in("valuation_id", rows.map((r) => r.id));
        if (!off) setPaidIds(new Set(((data as any[]) || []).map((d) => d.valuation_id as string)));
      } catch { /* chips fall back to Free */ }
    })();
    return () => { off = true; };
  }, [user, rows]);

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete this valuation?",
      description: "This cannot be undone. The report and any photos linked to it will be removed from your account.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("valuations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(rs => rs.filter(r => r.id !== id));
    toast.success("Valuation deleted");
  }

  const total = rows.length;
  const avg = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.private_value || 0), 0) / rows.length)
    : 0;
  const scored = rows.filter((r) => r.condition_score != null && hasPhotos(r.photo_urls));
  const avgCondition = scored.length
    ? (scored.reduce((s, r) => s + (r.condition_score || 0), 0) / scored.length).toFixed(1)
    : null;

  const trends = valueTrends(rows);
  // One MOT reminder per car (latest valuation of each reg), only when due within 60 days or overdue.
  const motReminders = (() => {
    const seen = new Set<string>();
    const out: { row: Row; due: NonNullable<ReturnType<typeof motDue>> }[] = [];
    for (const r of [...rows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))) {
      const key = (r.registration || r.id).replace(/\s+/g, "").toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const due = motDue(r.mot_expiry);
      if (due && due.status !== "upcoming") out.push({ row: r, due });
    }
    return out.slice(0, 3);
  })();

  const firstName = user?.email?.split("@")[0]?.replace(/[^a-zA-Z]/g, "") || "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const feedbackDue = rows.filter((r) => needsSaleFeedbackPrompt(r));
  const latest = rows.find((r) => !r.report?.valuationUnavailable && (r.private_value || 0) > 0) ?? null;
  const q = query.trim().toLowerCase();
  const list = [...rows.filter((r) => !q || `${r.year} ${r.make} ${r.model} ${r.registration || ""}`.toLowerCase().includes(q))].sort((a, b) => {
    switch (sort) {
      case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
      case "highest": return (b.private_value || 0) - (a.private_value || 0);
      case "lowest": return (a.private_value || 0) - (b.private_value || 0);
      default: return +new Date(b.created_at) - +new Date(a.created_at);
    }
  });
  const attention = motReminders.length + (feedbackDue.length ? 1 : 0);

  function startValuation(e: React.FormEvent) {
    e.preventDefault();
    const c = normaliseReg(reg);
    if (!isPlausibleUkReg(c)) { setRegErr("Enter a valid UK number plate, e.g. AB12 CDE."); return; }
    setRegErr(null);
    // The homepage flow starts the check from ?reg= (same entry the embeds and share links use).
    navigate(`/?reg=${encodeURIComponent(c)}`);
  }

  const heroVehicle = latest ? ((latest.report as any)?.vehicle ?? {}) : null;
  const heroImg = latest
    ? (renderFor({ make: latest.make, model: latest.model, year: latest.year, bodyStyle: heroVehicle?.bodyStyle }) || carImageSrc(bodyKeyFor({ bodyStyle: heroVehicle?.bodyStyle, doors: heroVehicle?.doors, model: latest.model, make: latest.make })))
    : null;
  const heroGrade = latest ? gradeFromReport(latest.report, { mileage: latest.mileage, firstRegistered: heroVehicle?.firstRegistered, year: latest.year }) : null;

  const regForm = (
    <form onSubmit={startValuation} className="w-full max-w-sm mx-auto" aria-label="Value another car">
      <div className="reg-plate" style={{ height: 56 }}>
        <input
          value={reg}
          onChange={(e) => { setReg(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 8)); setRegErr(null); }}
          placeholder="AB12 CDE"
          aria-label="Registration"
          aria-invalid={!!regErr}
          autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" size={1}
          className="reg-plate-input"
          style={{ fontSize: 30, textAlign: "center" }}
        />
      </div>
      {regErr && <p role="alert" className="mt-2 text-center text-xs text-destructive">{regErr}</p>}
      <Button type="submit" variant="hero" size="lg" className="mt-3 w-full">{latest ? "Value another car" : "Get a free valuation"} <ArrowRight className="h-4 w-4" aria-hidden /></Button>
    </form>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#111111]">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-6 md:py-10">
        {/* Hero: latest car in the same style as the valuation flow, or just the plate box when there is nothing yet */}
        <section className="t8 px-0 pt-6 pb-10 md:pt-10 border-b border-white/10" aria-label={latest ? "Your latest valuation" : "Start a valuation"}>
          <div className="t8-bgglow" aria-hidden />
          <div className="relative z-[2] flex flex-col items-center text-center">
            <p className="text-xs font-medium tracking-[.16em] uppercase text-[color:var(--t8-dim)]">
              {greeting}, {firstName}{latest ? " · Your latest valuation" : ""}
            </p>
            {loading ? (
              <div className="mt-6 h-[300px] w-full max-w-sm rounded-2xl shimmer" aria-hidden />
            ) : latest ? (
              <>
                <div className="mt-5 mb-1">
                  <FitPrice key={latest.id} text={headlinePrivateText(Math.round((latest.private_value || 0) / 50) * 50, latest.report)} className="t8-price" boxClassName="t8-pricebox" minPx={36} floorPx={16} testId="dash-price">
                    {(lines) => lines.map((l, i) => <RollingPrice key={i} text={l} />)}
                  </FitPrice>
                </div>
                <div className="t8-meta" style={{ marginTop: 6 }}>Private sale · {format(new Date(latest.created_at), "d MMM yyyy")}</div>
                {heroGrade && (
                  <div className="t8-grade" style={{ color: heroGrade.color, borderColor: `${heroGrade.color}59`, background: `${heroGrade.color}14` }} aria-label={`Car grade: ${heroGrade.label}`}>{heroGrade.label}</div>
                )}
                {heroImg && <img src={heroImg} alt="" aria-hidden className="mt-3 w-[260px] sm:w-[320px] h-auto opacity-95" />}
                <h1 className="mt-2 text-lg font-semibold tracking-tight">{vehicleTitle({ year: latest.year, make: latest.make, model: latest.model })}</h1>
                <div className="mt-1 text-xs text-muted-foreground">{latest.registration ? `${latest.registration.toUpperCase()} · ` : ""}{latest.mileage.toLocaleString("en-GB")} miles</div>
                <Button asChild variant="outline" size="sm" className="mt-3 min-h-[40px]">
                  <Link to={`/valuation/${latest.id}`}>View report <ArrowRight className="h-4 w-4" aria-hidden /></Link>
                </Button>
                <div className="mt-6 w-full">{regForm}</div>
              </>
            ) : (
              <>
                <h1 className="mt-3 mb-5 text-2xl sm:text-3xl font-semibold tracking-tight">Value your first car</h1>
                <p className="mb-5 max-w-xs text-sm text-muted-foreground">Enter a UK number plate for a free valuation. It takes about a minute.</p>
                {regForm}
              </>
            )}
          </div>
        </section>

        <div className="mt-5 empty:hidden"><AdvertFollowupCard /></div>

        {BILLING_ENABLED && !loading && rows.length > 0 && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Crown className={`h-3.5 w-3.5 ${isPremium ? "text-primary" : ""}`} aria-hidden />
            {isPremium ? "Premium: edit reports, export PDFs and create adverts." : <>Free plan. <Link to="/profile" className="text-primary hover:underline">Upgrade</Link> to edit reports, export PDFs and create adverts.</>}
          </p>
        )}

        {/* Needs attention: MOT reminders and the Sold-it prompt, grouped */}
        {!loading && attention > 0 && (
          <section aria-label="Needs attention" className="mt-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[.2em] text-[#ADADAD] mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden /> Needs attention <span className="text-muted-foreground font-normal">{attention}</span></h2>
            <div className="border-y border-white/10 divide-y divide-white/10">
              {motReminders.map(({ row, due }) => {
                const name = vehicleTitle({ year: row.year, make: row.make, model: row.model });
                const when = due.status === "overdue"
                  ? `MOT expired ${format(due.date, "d MMM yyyy")}`
                  : due.daysLeft === 0 ? "MOT due today" : `MOT due in ${due.daysLeft} day${due.daysLeft === 1 ? "" : "s"} (${format(due.date, "d MMM yyyy")})`;
                return (
                  <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm ${due.status === "overdue" ? "text-destructive" : "text-amber-300"}`}>{when}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{name}{row.registration ? ` · ${row.registration.toUpperCase()}` : ""}. A fresh MOT changes what buyers will pay, so revalue after your test.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {due.status !== "overdue" && (
                        <Button variant="outline" size="sm" className="min-h-[40px]" onClick={() => {
                          downloadIcs(`mot-${(row.registration || "car").replace(/\s+/g, "")}.ics`, buildMotIcs({ vehicle: name, registration: row.registration, motDate: due.date, url: `${SITE_URL}/valuation/new` }));
                        }}>
                          <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
                        </Button>
                      )}
                      <Button asChild variant="hero" size="sm" className="min-h-[40px]">
                        <Link to={row.registration ? `/?reg=${encodeURIComponent(normaliseReg(row.registration))}` : "/"}>Revalue</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {feedbackDue.length > 0 && (
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-medium">Sold your {vehicleTitle({ year: feedbackDue[0].year, make: feedbackDue[0].make, model: feedbackDue[0].model })}?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">If you've sold {feedbackDue.length > 1 ? "any of these cars" : "it"}, telling us the price takes a few seconds and helps make our valuations more accurate. Totally optional. <Link to="/accuracy" className="text-primary underline underline-offset-2">See our accuracy results</Link>.</p>
                  </div>
                  <Button asChild size="sm" variant="hero" className="shrink-0 min-h-[40px] w-full sm:w-auto">
                    <Link to={`/valuation/${feedbackDue[0].id}#sale-feedback`}>Sold it? Tell us what you got</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Saved cars */}
        {(loading || rows.length > 0) && (
          <section className="mt-10" aria-label="My valuations">
            <div className="flex items-end justify-between mb-4 gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Your cars</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {total} {total === 1 ? "valuation" : "valuations"}{total > 0 ? ` · average £${avg.toLocaleString("en-GB")}` : ""}{avgCondition ? ` · condition ${avgCondition}/10 avg` : ""}
                </p>
              </div>
            </div>

            {!loading && rows.length > 4 && (
              <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your saved valuations..." className="pl-10 h-11 bg-card/60 border-border/70 rounded-xl" />
                </div>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-11 w-full sm:w-[180px] bg-card/60 border-border/70 rounded-xl">
                    <div className="flex items-center gap-2"><ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="highest">Highest value</SelectItem>
                    <SelectItem value="lowest">Lowest value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading ? (
              <div className="grid gap-0">{[0, 1].map((i) => <div key={i} className="h-[150px] rounded-2xl shimmer" />)}</div>
            ) : list.length === 0 ? (
              <div className="border-y border-white/10 p-10 text-center">
                <h3 className="font-semibold">No matches</h3>
                <p className="text-muted-foreground mt-1 text-sm">Try a different search term.</p>
              </div>
            ) : (
              <div className="grid gap-0 border-t border-white/10">
                {list.map((r) => {
                  const cover = coverUrls[r.id] || null;
                  const unavailable = !!r.report?.valuationUnavailable;
                  const t = trends[r.id];
                  const paid = paidIds.has(r.id);
                  return (
                    <div key={r.id} className="group relative border-b border-white/10 hover:bg-white/[.03] transition-colors">
                      <Link to={`/valuation/${r.id}`} className="flex gap-3 p-3 pr-12">
                        <div className="relative h-16 w-20 rounded-xl bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border/60">
                          {cover ? <img src={cover} alt={`${r.year} ${r.make} ${r.model}`} loading="lazy" className="w-full h-full object-cover" />
                            : <div className="w-full h-full grid place-items-center text-muted-foreground/60 bg-gradient-to-br from-muted to-background"><Car className="h-6 w-6" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm leading-tight truncate">{vehicleTitle({ year: r.year, make: r.make, model: r.model })}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {r.registration && <span className="rounded bg-[#F7D800] px-1.5 py-px font-bold tracking-wide text-[#111] text-[11px]">{r.registration.toUpperCase()}</span>}
                            <span>{format(new Date(r.created_at), "d MMM yyyy")}</span>
                          </div>
                          <div className="mt-1.5 font-bold tabular-nums text-base leading-tight text-gradient-primary">
                            {unavailable ? <span className="text-amber-300 text-sm font-semibold">Specialist valuation recommended</span> : headlinePrivateText(Math.round((r.private_value || 0) / 50) * 50, r.report)}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${paid ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {paid && <Crown className="h-2.5 w-2.5" aria-hidden />}{paid ? "Premium" : "Free"}
                            </span>
                            {r.condition_score != null && hasPhotos(r.photo_urls) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums"><Activity className="h-2.5 w-2.5" />{Number(r.condition_score).toFixed(1)}/10</span>
                            )}
                            {t && (() => {
                              const up = t.change > 0, flat = t.change === 0;
                              const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
                              return (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${flat ? "bg-muted text-muted-foreground" : up ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                                  title={`Previous valuation £${t.previousValue.toLocaleString()} on ${format(new Date(t.previousDate), "d MMM yyyy")}`}>
                                  <Icon className="h-2.5 w-2.5" aria-hidden />
                                  {flat ? "No change" : `${up ? "+" : "−"}£${Math.abs(t.change).toLocaleString()} (${up ? "+" : "−"}${Math.abs(t.pct)}%)`}
                                  <span className="sr-only"> since valuation on {format(new Date(t.previousDate), "d MMM yyyy")}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </Link>
                      <div className="absolute right-2 top-2 flex flex-col items-center gap-0.5">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title={isPremium || !BILLING_ENABLED ? "Edit" : "Premium feature"} aria-label="Edit valuation">
                          <Link to={`/valuation/${r.id}/edit`}>{isPremium || !BILLING_ENABLED ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : <Crown className="h-3.5 w-3.5 text-primary" aria-hidden />}</Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg hidden sm:inline-flex" title="View report" aria-label="View report">
                          <Link to={`/valuation/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Delete" aria-label="Delete valuation" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(r.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive/80" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
