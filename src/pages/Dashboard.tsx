import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Car, TrendingUp, Activity, Pencil, Crown, Trash2, Search, ArrowUpDown, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/ConfirmDialog";


type SortKey = "newest" | "oldest" | "highest" | "lowest";

interface Row {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => { document.title = "Dashboard — Valu8"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("valuations")
      .select("id,make,model,year,mileage,registration,condition_score,private_value,created_at,photo_urls,report")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as any) || []); setLoading(false); });
  }, [user]);

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
  const avgCondition = rows.length
    ? (rows.reduce((s, r) => s + (r.condition_score || 0), 0) / rows.length).toFixed(1)
    : "—";

  const firstName = user?.email?.split("@")[0]?.replace(/[^a-zA-Z]/g, "") || "there";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container max-w-5xl py-8 md:py-12">
        {/* Welcome header */}
        <div className="mb-10 animate-fade-in-up">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold mb-2">{greeting}</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient capitalize">
            Welcome back, {firstName}.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-lg">
            Generate a new valuation, or revisit one of your saved reports.
          </p>
        </div>

        {/* Primary CTA + premium status */}
        <section className="grid md:grid-cols-3 gap-3 mb-10">
          <Link
            to="/valuation/new"
            className="md:col-span-2 group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-7 transition-all hover:border-primary/60"
          >
            <div className="relative flex items-center justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-primary font-medium mb-2">Start now</div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">New Valuation</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                  60 seconds. Photo aware. Built around real 2026 UK private sale prices.
                </p>
              </div>
              <span className="hidden sm:grid h-12 w-12 rounded-2xl bg-primary text-primary-foreground place-items-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Plus className="h-6 w-6" />
              </span>
            </div>
          </Link>

          <div className={`relative overflow-hidden rounded-2xl border p-5 ${
            isPremium ? "border-primary/40 bg-primary/5" : "border-border bg-card"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Crown className={`h-4 w-4 ${isPremium ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">{isPremium ? "Premium" : "Free plan"}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isPremium
                ? "Edit reports, export PDFs and create adverts."
                : "Upgrade to edit reports, export PDFs and create adverts."}
            </p>
            {!isPremium && (
              <Button asChild variant="link" size="sm" className="px-0 mt-2 h-auto text-primary">
                <Link to="/profile">Upgrade →</Link>
              </Button>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3 mb-8">
          <StatCard icon={<Car className="h-3.5 w-3.5" />} label="Reports" value={String(total)} />
          <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg value" value={total ? `£${avg.toLocaleString()}` : "—"} />
          <StatCard icon={<Activity className="h-3.5 w-3.5" />} label="Avg condition" value={total ? `${avgCondition}/10` : "—"} />
        </section>

        {/* List header with search + sort */}
        <div className="flex items-end justify-between mb-4 gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">My Valuations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total} {total === 1 ? "report" : "reports"}
            </p>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your saved valuations..."
                className="pl-10 h-11 bg-card/60 border-border/70 rounded-xl"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-11 w-[180px] bg-card/60 border-border/70 rounded-xl">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
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

        {(() => {
          if (loading) {
            return (
              <div className="grid gap-3">
                {[0, 1, 2].map(i => <div key={i} className="h-[120px] rounded-2xl shimmer" />)}
              </div>
            );
          }
          if (rows.length === 0) {
            return (
              <div className="premium-card relative overflow-hidden p-10 sm:p-14 text-center">
                <div className="relative">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-6 ring-1 ring-primary/20">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">No valuations yet</h3>
                  <p className="text-muted-foreground mt-2 text-sm max-w-sm mx-auto">
                    Get your first photo aware valuation in under a minute.
                  </p>
                  <Button asChild variant="hero" size="lg" className="mt-7">
                    <Link to="/valuation/new"><Plus className="h-4 w-4" /> Start your first valuation</Link>
                  </Button>
                </div>
              </div>
            );
          }

          const q = query.trim().toLowerCase();
          let list = rows.filter(r =>
            !q ||
            `${r.year} ${r.make} ${r.model} ${r.registration || ""}`.toLowerCase().includes(q)
          );
          list = [...list].sort((a, b) => {
            switch (sort) {
              case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
              case "highest": return (b.private_value || 0) - (a.private_value || 0);
              case "lowest": return (a.private_value || 0) - (b.private_value || 0);
              default: return +new Date(b.created_at) - +new Date(a.created_at);
            }
          });

          if (list.length === 0) {
            return (
              <div className="premium-card p-10 text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-muted grid place-items-center mb-4">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No matches</h3>
                <p className="text-muted-foreground mt-1 text-sm">Try a different search term.</p>
              </div>
            );
          }

          return (
            <div className="grid gap-3">
              {list.map((r) => {
                const cover = Array.isArray(r.photo_urls) ? r.photo_urls[0] : null;
                const variant = (r as any).report?.variant || (r as any).variant;
                const valuationUnavailable = !!r.report?.valuationUnavailable;
                return (
                  <div
                    key={r.id}
                    className="group relative premium-card hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                  >
                    <Link to={`/valuation/${r.id}`} className="flex items-stretch gap-4 p-3 sm:p-4 pr-20 sm:pr-24">
                      {/* Thumbnail */}
                      <div className="relative h-20 w-20 sm:h-24 sm:w-32 rounded-xl bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border/60 shadow-soft">
                        {cover ? (
                          <img
                            src={cover}
                            alt={`${r.year} ${r.make} ${r.model}`}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-muted-foreground/60 bg-gradient-to-br from-muted to-background">
                            <Car className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[80px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[15px] sm:text-base truncate leading-tight tracking-tight">
                            {r.year} {r.make} {r.model}
                            {variant && <span className="text-muted-foreground font-medium"> · {variant}</span>}
                          </h3>
                          {r.report?.edited && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
                              <Pencil className="h-2.5 w-2.5" /> Edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11.5px] text-muted-foreground flex-wrap">
                          <span className="tabular-nums">{r.mileage.toLocaleString()} mi</span>
                          {r.registration && (
                            <>
                              <span className="opacity-30">•</span>
                              <span className="font-mono uppercase text-foreground/70">{r.registration}</span>
                            </>
                          )}
                          <span className="opacity-30">•</span>
                          <span>{format(new Date(r.created_at), "d MMM yyyy")}</span>
                          {r.condition_score != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold tabular-nums ml-0.5">
                              <Activity className="h-2.5 w-2.5" />
                              {Number(r.condition_score).toFixed(1)}/10
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right flex flex-col justify-center flex-shrink-0">
                        <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                          {valuationUnavailable ? "Status" : "Private sale"}
                        </div>
                        {valuationUnavailable ? (
                          <div className="font-semibold text-amber-300 text-sm sm:text-base leading-tight mt-0.5 max-w-[160px]">
                            Specialist appraisal needed
                          </div>
                        ) : (
                          <div className="font-bold text-gradient-primary text-lg sm:text-2xl tabular-nums leading-tight mt-0.5">
                            £{(r.private_value || 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Actions */}
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title={isPremium ? "Edit" : "Premium feature"}>
                        <Link to={`/valuation/${r.id}/edit`} onClick={(e) => e.stopPropagation()}>
                          {isPremium ? <Pencil className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5 text-primary" />}
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg hidden sm:inline-flex" title="View report">
                        <Link to={`/valuation/${r.id}`} onClick={(e) => e.stopPropagation()}><Eye className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        title="Delete"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(r.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive/80" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-[0.15em]">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <div className="text-xl sm:text-2xl font-bold mt-1.5 tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
