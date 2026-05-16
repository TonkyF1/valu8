import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  is_premium: boolean;
  plan: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
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
        .select("is_premium, plan, full_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(data ?? { is_premium: true, plan: "monthly", full_name: null, username: null, avatar_url: null });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function setPremium(is_premium: boolean, plan: string = is_premium ? "monthly" : "free") {
    if (!user) return;
    await supabase.from("profiles").upsert({ user_id: user.id, is_premium, plan }, { onConflict: "user_id" });
    setProfile((p) => ({ ...(p ?? { full_name: null, username: null, avatar_url: null }), is_premium, plan }));
  }

  async function updateProfile(updates: { full_name?: string | null; username?: string | null; avatar_url?: string | null }) {
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });
    if (error) throw error;
    setProfile((p) => ({ ...(p ?? { is_premium: true, plan: "monthly", full_name: null, username: null, avatar_url: null }), ...updates }));
  }

  // While Stripe billing is being finalised, every signed-in user gets full access.
  // Real billing will flip this back to `!!profile?.is_premium`.
  return { profile, loading, isPremium: true, setPremium, updateProfile };
}
