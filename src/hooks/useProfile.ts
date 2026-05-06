import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  is_premium: boolean;
  plan: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_premium, plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(data ?? { is_premium: false, plan: "free" });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function setPremium(is_premium: boolean, plan: string = is_premium ? "monthly" : "free") {
    if (!user) return;
    await supabase.from("profiles").upsert({ user_id: user.id, is_premium, plan }, { onConflict: "user_id" });
    setProfile({ is_premium, plan });
  }

  return { profile, loading, isPremium: !!profile?.is_premium, setPremium };
}
