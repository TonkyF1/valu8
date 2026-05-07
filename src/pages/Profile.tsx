import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Crown, LogOut, Mail, KeyRound, CreditCard, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isPremium, setPremium, profile } = useProfile();
  const navigate = useNavigate();
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Profile — Valu8"; }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) return toast.error("Password must be at least 8 characters");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNewPw("");
    toast.success("Password updated");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container max-w-3xl py-8 md:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        </Button>

        <div className="mb-8 animate-fade-in-up">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold mb-1.5">Account</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient">Profile & Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm">Manage your account, subscription and security.</p>
        </div>

        {/* Account */}
        <section className="premium-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Mail className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Account</h2>
              <p className="text-xs text-muted-foreground">Signed in as</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm font-medium break-all">{user?.email}</div>
        </section>

        {/* Subscription */}
        <section className="premium-card p-6 mb-4 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Crown className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold">Subscription</h2>
                <p className="text-xs text-muted-foreground capitalize">{profile?.plan ?? "free"} plan</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isPremium ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <Sparkles className="h-3 w-3" />{isPremium ? "Premium" : "Free"}
            </span>
          </div>

          {isPremium ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground/80">You have unlimited valuations, full editing, and priority AI accuracy.</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => toast.info("Billing portal coming soon")}>
                  <CreditCard className="h-4 w-4" /> Manage billing
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPremium(false, "free")}>
                  Cancel subscription
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-2 text-sm text-foreground/85">
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5" /> Unlimited valuations & PDF exports</li>
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5" /> Edit & regenerate any saved report</li>
                <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5" /> AI-generated adverts for AutoTrader, Facebook & Gumtree</li>
              </ul>
              <div className="flex gap-2 flex-wrap">
                <Button variant="hero" size="lg" onClick={() => setPremium(true, "monthly")}>
                  <Crown className="h-4 w-4" /> Activate Premium · £9.99/mo
                </Button>
                <Button variant="ghost" size="lg" onClick={() => setPremium(true, "annual")}>
                  Annual · £79/yr
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Password */}
        <section className="premium-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><KeyRound className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Change password</h2>
              <p className="text-xs text-muted-foreground">Use 8 characters or more.</p>
            </div>
          </div>
          <form onSubmit={changePassword} className="flex gap-2 flex-wrap">
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password"
              className="flex-1 min-w-[220px]"
            />
            <Button type="submit" variant="premium" disabled={saving}>
              {saving ? "Saving…" : "Update password"}
            </Button>
          </form>
        </section>

        {/* Sign out */}
        <section className="premium-card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold">Sign out</h2>
              <p className="text-xs text-muted-foreground">You'll need to sign in again to access your valuations.</p>
            </div>
            <Button variant="ghost" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
