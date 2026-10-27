import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header, TestModeBanner } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReadinessPanel } from "@/components/admin/ReadinessPanel";
import { GrowthPanel } from "@/components/admin/GrowthPanel";

// Access is enforced in the database: admin_stats() raises 'forbidden' unless
// the caller has the 'admin' role in public.user_roles. This page only hides UI.
export default function Admin() {
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "forbidden" | "ok">("loading");
  const [stats, setStats] = useState<Record<string, number>>({});
  useSeo(getRouteMeta("/admin"));
  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("admin_stats").then(({ data, error }: any) => {
      if (error || !data) setState("forbidden");
      else { setStats(data); setState("ok"); }
    });
  }, [user]);

  if (state === "forbidden") return <Navigate to="/dashboard" replace />;
  const LABELS: Record<string, string> = {
    users: "Users", users_7d: "New users (7d)", valuations: "Valuations", valuations_24h: "Valuations (24h)",
    valuations_7d: "Valuations (7d)", premium_users: "Premium flag set", rate_limited_keys_24h: "Heavy-use keys (24h)",
  };
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-4xl py-10">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> Admin</h1>
        {state === "loading" ? (
          <p className="mt-6 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</p>
        ) : (
          <Tabs defaultValue="overview" className="mt-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="readiness">Readiness</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card/60 p-4">
                <dt className="text-xs text-muted-foreground">{LABELS[k] ?? k}</dt>
                <dd className="text-2xl font-semibold mt-1">{Number(v).toLocaleString("en-GB")}</dd>
              </div>
            ))}
          </dl>
            </TabsContent>
            <TabsContent value="readiness"><GrowthPanel /><ReadinessPanel /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
