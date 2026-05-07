import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Car, TrendingUp, Activity, Pencil, Crown, ArrowUpRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const { isPremium, setPremium } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Dashboard — Valu8"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("valuations")
      .select("id,make,model,year,mileage,registration,condition_score,private_value,created_at,photo_urls,report")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as any) || []); setLoading(false); });
  }, [user]);

  async function remove(id: string) {
    if (!confirm("Delete this valuation? This cannot be undone.")) return;
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

        {/* Primary CTA + premium toggle */}
        <section className="grid md:grid-cols-3 gap-3 mb-10">
          <Link
            to="/valuation/new"
            className="md:col-span-2 group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-7 transition-all hover:border-primary/70 hover:shadow-glow"
          >
            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary/15 blur-3xl pointer-events-none transition-opacity group-hover:opacity-150" />
            <div className="relative flex items-center justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold mb-2">Start now</div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">New Valuation</h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                  60 seconds. Photo-aware. Built around real 2026 UK private-sale prices.
                </p>
              </div>
              <span className="hidden sm:grid h-12 w-12 rounded-2xl bg-primary text-primary-foreground place-items-center shadow-glow flex-shrink-0 group-hover:scale-110 transition-transform">
                <Plus className="h-6 w-6" />
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setPremium(!isPremium, isPremium ? "free" : "monthly")}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
              isPremium
                ? "border-primary/40 bg-primary/5 hover:border-primary/70"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Crown className={`h-5 w-5 ${isPremium ? "text-primary" : "text-muted-foreground"}`} />
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-sm font-semibold">{isPremium ? "Premium active" : "Activate Premium"}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {isPremium ? "Unlimited edits & exports" : "Edit, regenerate, and unlock adverts"}
            </div>
          </button>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3 mb-8">
          <StatCard icon={<Car className="h-3.5 w-3.5" />} label="Reports" value={String(total)} />
          <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg value" value={total ? `£${avg.toLocaleString()}` : "—"} />
          <StatCard icon={<Activity className="h-3.5 w-3.5" />} label="Avg condition" value={total ? `${avgCondition}/10` : "—"} />
        </section>

        {/* List */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">My Valuations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{total} {total === 1 ? "report" : "reports"}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-2.5">
            {[0, 1, 2].map(i => <div key={i} className="h-[88px] rounded-2xl shimmer" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="premium-card p-14 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-5">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No valuations yet</h3>
            <p className="text-muted-foreground mt-1.5 text-sm max-w-sm mx-auto">
              Get your first AI-powered valuation in under a minute.
            </p>
            <Button asChild variant="hero" size="lg" className="mt-6">
              <Link to="/valuation/new"><Plus className="h-4 w-4" /> Start a valuation</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {rows.map(r => {
              const cover = Array.isArray(r.photo_urls) ? r.photo_urls[0] : null;
              return (
                <div
                  key={r.id}
                  className="group relative rounded-2xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-soft transition-all overflow-hidden"
                >
                  <Link to={`/valuation/${r.id}`} className="flex items-center gap-4 p-3 sm:p-4">
                    {/* Thumbnail */}
                    <div className="h-16 w-16 sm:h-[72px] sm:w-[88px] rounded-xl bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border/60">
                      {cover ? (
                        <img src={cover} alt={`${r.make} ${r.model}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground/60">
                          <Car className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-semibold text-[15px] truncate leading-tight">
                          {r.year} {r.make} {r.model}
                        </h3>
                        {r.report?.edited && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider">
                            <Pencil className="h-2.5 w-2.5" /> Edited
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span className="tabular-nums">{r.mileage.toLocaleString()} mi</span>
                        {r.registration && (
                          <>
                            <span className="opacity-40">•</span>
                            <span className="font-mono uppercase">{r.registration}</span>
                          </>
                        )}
                        {r.condition_score != null && (
                          <>
                            <span className="opacity-40">•</span>
                            <span>Condition <span className="text-foreground/80 tabular-nums">{Number(r.condition_score).toFixed(1)}</span></span>
                          </>
                        )}
                        <span className="opacity-40">•</span>
                        <span>{format(new Date(r.created_at), "d MMM yyyy")}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right hidden xs:block sm:block flex-shrink-0">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Private</div>
                      <div className="font-bold text-gradient-primary text-lg sm:text-xl tabular-nums leading-tight">
                        £{(r.private_value || 0).toLocaleString()}
                      </div>
                    </div>
                  </Link>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 sm:static sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-card/80 backdrop-blur rounded-full border border-border/60 sm:border-0 sm:bg-transparent sm:backdrop-blur-0">
                    <Button asChild variant="ghost" size="icon" title={isPremium ? "Edit" : "Premium feature"}>
                      <Link to={`/valuation/${r.id}/edit`}>
                        {isPremium ? <Pencil className="h-4 w-4" /> : <Crown className="h-4 w-4 text-primary" />}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" title="View report">
                      <Link to={`/valuation/${r.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive/80" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
