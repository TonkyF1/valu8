import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TestModeBanner, Header } from "@/components/Layout";
import { Lock } from "lucide-react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("has_beta_access");
      if (cancelled) return;
      setHasAccess(!error && data === true);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && checking)) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <TestModeBanner />
        <Header />
        <main className="flex-1 grid place-items-center px-4 py-12 hero-glow">
          <div className="w-full max-w-md text-center animate-fade-in-up">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-muted items-center justify-center mb-5">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Testing spots are full</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for your interest! All testing spots are now full. We'll be opening
              up access to more users soon — check back shortly.
            </p>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
