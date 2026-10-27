import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { claimGuestValuations } from "@/lib/guest";
import { recordSignupSource } from "@/lib/attribution";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // A guest who signs in or signs up keeps the valuations they made as a guest.
  const uid = session?.user?.id ?? null;
  useEffect(() => {
    if (!uid) return;
    void claimGuestValuations(uid);
    // Referral + UTM source for new accounts (works for email, magic link and Google sign-up).
    void recordSignupSource(uid, (fn, args) => (supabase as any).rpc(fn, args));
  }, [uid]);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
