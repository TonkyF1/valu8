import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Car, TrendingUp, Activity, Pencil, Crown } from "lucide-react";
import { format } from "date-fns";

interface Row {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
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

  useEffect(() => { document.title = "My valuations — Valu8"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("valuations")
      .select("id,make,model,year,mileage,condition_score,private_value,created_at,photo_urls,report")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as Row[]) || []); setLoading(false); });
  }, [user]);

  const total = rows.length;
  const avg = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.private_value || 0), 0) / rows.length)
    : 0;
  const avgCondition = rows.length
    ? (rows.reduce((s, r) => s + (r.condition_score || 0), 0) / rows.length).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Valuations</h1>
            <p className="text-muted-foreground mt-2">Every report you've generated, all in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPremium(!isPremium, isPremium ? "free" : "monthly")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isPremium
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle Premium (test mode)"
            >
              <Crown className="h-3.5 w-3.5" />
              {isPremium ? "Premium active" : "Activate Premium"}
            </button>
            <Button asChild variant="hero" size="lg">
              <Link to="/valuation/new"><Plus className="h-4 w-4" /> New valuation</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={<Car className="h-4 w-4" />} label="Total valuations" value={String(total)} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Average value" value={total ? `£${avg.toLocaleString()}` : "—"} />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Avg condition" value={`${avgCondition}${total ? " / 10" : ""}`} />
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[0,1,2].map(i => <div key={i} className="h-24 rounded-xl shimmer" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="premium-card p-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-4">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No valuations yet</h2>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Get your first AI-powered valuation in under a minute.</p>
            <Button asChild variant="hero" size="lg" className="mt-6">
              <Link to="/valuation/new"><Plus className="h-4 w-4" /> Start a valuation</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map(r => {
              const cover = Array.isArray(r.photo_urls) ? r.photo_urls[0] : null;
              return (
                <div key={r.id} className="premium-card p-4 sm:p-5 flex items-center gap-4 hover:border-primary/40 transition-colors group">
                  <Link to={`/valuation/${r.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-16 w-20 sm:h-20 sm:w-28 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {cover ? (
                        <img src={cover} alt={`${r.make} ${r.model}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground"><Car className="h-5 w-5" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{r.year} {r.make} {r.model}</h3>
                        <span className="text-xs text-muted-foreground">{r.mileage.toLocaleString()} mi</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{format(new Date(r.created_at), "d MMM yyyy")}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">Private sale</div>
                      <div className="font-semibold text-gradient-primary text-lg">£{(r.private_value || 0).toLocaleString()}</div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button asChild variant="ghost" size="sm" title={isPremium ? "Edit valuation" : "Premium feature"}>
                      <Link to={`/valuation/${r.id}/edit`}>
                        {isPremium ? <Pencil className="h-4 w-4" /> : <Crown className="h-4 w-4 text-primary" />}
                        <span className="hidden sm:inline">Edit</span>
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/valuation/${r.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">View</span>
                      </Link>
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
    <div className="premium-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <span className="text-primary">{icon}</span>{label}
      </div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
    </div>
  );
}
