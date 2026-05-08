import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Crown, LogOut, Mail, KeyRound, CreditCard, ShieldCheck, Sparkles, ArrowLeft, User as UserIcon, Upload, Trash2, Receipt, Download, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isPremium, setPremium, profile, updateProfile } = useProfile();
  const navigate = useNavigate();
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { document.title = "Profile — Valu8"; }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUsername(profile.username ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

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

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally { setUploading(false); }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (username && !/^[a-z0-9_]{3,20}$/i.test(username)) {
      return toast.error("Username must be 3–20 letters, numbers or underscores");
    }
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        avatar_url: avatarUrl,
      });
      toast.success("Profile saved");
    } catch (err: any) {
      const msg = err?.message?.includes("profiles_username_unique") || err?.code === "23505"
        ? "That username is already taken"
        : err?.message || "Failed to save";
      toast.error(msg);
    } finally { setSavingProfile(false); }
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

        {/* Profile editing */}
        <section className="premium-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><UserIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Your profile</h2>
              <p className="text-xs text-muted-foreground">Personalise how you appear in Valu8.</p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted/40 border border-border grid place-items-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex">
                  <input type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} disabled={uploading} />
                  <Button type="button" variant="premium" size="sm" disabled={uploading} asChild>
                    <span className="cursor-pointer"><Upload className="h-4 w-4" /> {uploading ? "Uploading…" : avatarUrl ? "Replace photo" : "Upload photo"}</span>
                  </Button>
                </label>
                {avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="fullName" className="h-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Alex Morgan" maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="username" className="h-10" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="alex_morgan" maxLength={20} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="hero" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>

        {/* Subscription & Billing */}
        <SubscriptionBilling
          isPremium={isPremium}
          plan={profile?.plan ?? "free"}
          email={user?.email ?? ""}
          onUpgrade={(p) => setPremium(true, p)}
          onCancel={() => setPremium(false, "free")}
        />

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

function BillingSection({ isPremium, plan, onUpgrade, onCancel }: { isPremium: boolean; plan: string; onUpgrade: () => void; onCancel: () => void }) {
  // Mock billing data — replace with real Stripe data when payments are enabled
  const today = new Date();
  const nextBilling = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const invoices = isPremium
    ? [
        { id: "INV-2026-0005", date: new Date(today.getFullYear(), today.getMonth(), 1), amount: plan === "annual" ? 79.0 : 9.99, status: "Paid" },
        { id: "INV-2026-0004", date: new Date(today.getFullYear(), today.getMonth() - 1, 1), amount: plan === "annual" ? 79.0 : 9.99, status: "Paid" },
        { id: "INV-2026-0003", date: new Date(today.getFullYear(), today.getMonth() - 2, 1), amount: 9.99, status: "Paid" },
      ]
    : [];

  return (
    <section className="premium-card p-6 mb-4">
      <div className="flex items-center gap-3 mb-5">
        <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Receipt className="h-5 w-5" /></span>
        <div>
          <h2 className="font-semibold">Billing</h2>
          <p className="text-xs text-muted-foreground">Plan, payment method and invoice history.</p>
        </div>
      </div>

      {!isPremium ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
          <p className="text-sm text-muted-foreground">You're on the <span className="text-foreground font-medium">Free plan</span>. Upgrade to unlock invoices, billing history and Premium features.</p>
          <Button variant="hero" size="sm" className="mt-4" onClick={onUpgrade}>
            <Crown className="h-4 w-4" /> Upgrade to Premium
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top row: plan + next billing + payment method */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Current plan</div>
              <div className="text-base font-semibold capitalize flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {plan === "annual" ? "Annual" : "Monthly"} Premium
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">£{plan === "annual" ? "79.00 / yr" : "9.99 / mo"}</div>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Next billing</div>
              <div className="text-base font-semibold">{fmt(nextBilling)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Auto-renew on</div>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Payment method</div>
              <div className="text-base font-semibold tabular-nums">Visa •••• 4242</div>
              <div className="text-xs text-muted-foreground mt-0.5">Expires 09/28</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="premium" size="sm" onClick={() => toast.info("Stripe billing portal coming soon")}>
              <CreditCard className="h-4 w-4" /> Manage subscription
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Update payment method coming soon")}>
              Update card
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel subscription
            </Button>
          </div>

          {/* Invoice history */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2.5">Invoice history</div>
            <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/60">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{inv.id}</div>
                    <div className="text-[11px] text-muted-foreground">{fmt(inv.date)}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm tabular-nums font-medium">£{inv.amount.toFixed(2)}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{inv.status}</span>
                    <button
                      onClick={() => toast.info("Invoice download coming soon")}
                      className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                      aria-label="Download invoice"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
