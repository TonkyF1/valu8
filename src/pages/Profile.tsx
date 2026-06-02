import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Crown, LogOut, Mail, KeyRound, CreditCard, ShieldCheck, Sparkles, ArrowLeft, User as UserIcon, Upload, Trash2, Receipt, Download, Calendar, Chrome, Link2, Unlink, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isPremium, setPremium, profile, updateProfile } = useProfile();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const hasGoogle = user?.identities?.some((i) => i.provider === "google");

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

  async function linkGoogle() {
    setLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({ provider: "google" } as any);
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Couldn't link Google account");
      setLinkingGoogle(false);
    }
  }

  async function unlinkGoogle() {
    const identity = user?.identities?.find((i: any) => i.provider === "google");
    if (!identity) return;
    setLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity as any);
      if (error) throw error;
      toast.success("Google account disconnected");
    } catch (err: any) {
      toast.error(err.message || "Couldn't unlink Google account");
    } finally {
      setLinkingGoogle(false);
    }
  }


  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 container max-w-3xl py-8 md:py-12">
        <div className="flex items-start justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
            </Button>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold mb-1.5">Account</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient">Profile & Settings</h1>
            <p className="text-muted-foreground mt-2 text-sm">Manage your account, subscription and security.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await signOut(); navigate("/"); }}
            className="text-muted-foreground hover:text-foreground mt-1 shrink-0"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        {/* Profile */}
        <section className="premium-card p-6 sm:p-7 mb-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><UserIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Profile</h2>
              <p className="text-xs text-muted-foreground">How you appear in Valu8.</p>
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
                    <span className="cursor-pointer"><Upload className="h-4 w-4" /> {uploading ? "Uploading…" : avatarUrl ? "Replace" : "Upload photo"}</span>
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
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" className="h-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Alex Morgan" maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" className="h-10" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="alex_morgan" maxLength={20} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <div className="h-10 rounded-md bg-muted/30 border border-border/60 px-3 flex items-center text-sm break-all text-muted-foreground">
                  <Mail className="h-4 w-4 mr-2 shrink-0" /> {user?.email}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="newPw">New password <span className="text-muted-foreground font-normal">· min 8 characters</span></Label>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="flex-1 min-w-[220px] h-10"
                  />
                  <Button type="button" variant="ghost" onClick={(e) => changePassword(e as any)} disabled={saving || newPw.length === 0}>
                    <KeyRound className="h-4 w-4" /> {saving ? "Saving…" : "Update password"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" variant="hero" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>

        {/* Connected Accounts */}
        <section className="premium-card p-6 sm:p-7 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold">Connected Accounts</h2>
              <p className="text-xs text-muted-foreground">Manage how you sign in to Valu8.</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 border border-border/60 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-9 w-9 rounded-lg bg-background border border-border/60 grid place-items-center shrink-0">
                <Chrome className="h-5 w-5 text-[#4285F4]" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">Google</div>
                <div className="text-xs text-muted-foreground truncate">
                  {hasGoogle ? "Connected" : "Not connected"}
                </div>
              </div>
            </div>
            {hasGoogle ? (
              <Button variant="ghost" size="sm" onClick={unlinkGoogle} disabled={linkingGoogle}>
                <Unlink className="h-4 w-4" /> {linkingGoogle ? "Working…" : "Disconnect"}
              </Button>
            ) : (
              <Button variant="premium" size="sm" onClick={linkGoogle} disabled={linkingGoogle}>
                <Link2 className="h-4 w-4" /> {linkingGoogle ? "Working…" : "Connect"}
              </Button>
            )}
          </div>
        </section>

        {/* Subscription & Billing — temporarily removed; all features free during launch */}

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-10 w-10 rounded-xl bg-destructive/15 text-destructive grid place-items-center">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">Delete account</h2>
              <p className="text-xs text-muted-foreground">Permanently removes your account, valuations and photos. This cannot be undone.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete your Valu8 account?",
                description: "Every valuation, photo and account record will be permanently erased. You'll be signed out immediately.",
                confirmLabel: deleting ? "Deleting…" : "Delete forever",
                destructive: true,
              });
              if (!ok) return;
              setDeleting(true);
              try {
                const { error } = await supabase.functions.invoke("delete-account");
                if (error) throw error;
                toast.success("Account deleted");
                await signOut();
                navigate("/", { replace: true });
              } catch (err: any) {
                toast.error(err.message || "Couldn't delete account");
                setDeleting(false);
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function downloadInvoicePdf(inv: { id: string; date: Date; amount: number; status: string }, plan: string, email: string) {
  // Lazy import to keep initial bundle small
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    // Header band
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, pageW, 90, "F");
    doc.setTextColor(0, 212, 200);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("VALU8 — INVOICE", margin, 38);
    doc.setTextColor(255, 255, 255); doc.setFontSize(20);
    doc.text(inv.id, margin, 64);

    let y = 130;
    doc.setTextColor(60, 60, 70); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("Billed to", margin, y);
    doc.text("Date", pageW - margin - 160, y);
    doc.text("Status", pageW - margin - 60, y);

    y += 16;
    doc.setTextColor(20, 20, 25); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(email || "—", margin, y);
    doc.text(fmt(inv.date), pageW - margin - 160, y);
    doc.text(inv.status, pageW - margin - 60, y);

    // Line items
    y += 50;
    doc.setDrawColor(220, 220, 225); doc.line(margin, y, pageW - margin, y); y += 22;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(120, 120, 130);
    doc.text("DESCRIPTION", margin, y);
    doc.text("AMOUNT", pageW - margin, y, { align: "right" });
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(20, 20, 25);
    const desc = `Valu8 Premium — ${plan === "annual" ? "Annual" : "Monthly"} subscription`;
    doc.text(desc, margin, y);
    doc.text(`£${inv.amount.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 24;
    doc.setDrawColor(220, 220, 225); doc.line(margin, y, pageW - margin, y); y += 28;

    // Total
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Total", margin, y);
    doc.setTextColor(0, 170, 160);
    doc.text(`£${inv.amount.toFixed(2)} GBP`, pageW - margin, y, { align: "right" });

    // Footer
    doc.setTextColor(140, 140, 150); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Thank you for using Valu8. This is a system-generated invoice.", margin, 780);

    doc.save(`${inv.id}.pdf`);
  });
}

function SubscriptionBilling({ isPremium, plan, email, onUpgrade, onCancel }: { isPremium: boolean; plan: string; email: string; onUpgrade: (plan: "monthly" | "annual") => void; onCancel: () => void }) {
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
    <section className="premium-card p-6 mb-4 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Crown className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold">Subscription & Billing</h2>
            <p className="text-xs text-muted-foreground">Plan, payment and invoices.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${isPremium ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <Sparkles className="h-3 w-3" />{isPremium ? "Premium" : "Free"}
        </span>
      </div>

      {!isPremium ? (
        <div className="space-y-4">
          <ul className="grid sm:grid-cols-3 gap-2 text-sm text-foreground/85">
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Unlimited valuations & PDFs</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Edit & regenerate reports</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" /> AI-generated adverts</li>
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Button variant="hero" size="lg" onClick={() => onUpgrade("monthly")}>
              <Crown className="h-4 w-4" /> Premium · £9.99/mo
            </Button>
            <Button variant="ghost" size="lg" onClick={() => onUpgrade("annual")}>
              Annual · £79/yr
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top row: plan + next billing + payment method */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Plan</div>
              <div className="text-base font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {plan === "annual" ? "Annual" : "Monthly"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">£{plan === "annual" ? "79.00 / yr" : "9.99 / mo"}</div>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Next billing</div>
              <div className="text-base font-semibold">{fmt(nextBilling)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Auto-renew</div>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/60 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Payment</div>
              <div className="text-base font-semibold tabular-nums">Visa •••• 4242</div>
              <div className="text-xs text-muted-foreground mt-0.5">Exp. 09/28</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="premium" size="sm" onClick={() => toast.info("Paid billing launches soon — your account already has full access.")}>
              <CreditCard className="h-4 w-4" /> Manage subscription
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Paid billing launches soon — no card needed today.")}>
              Update card
            </Button>
          </div>

          {/* Invoice history */}
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-2.5">
              <Receipt className="h-3.5 w-3.5" /> Invoice history
            </div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => downloadInvoicePdf(inv, plan, email)}
                      aria-label={`Download ${inv.id} as PDF`}
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
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
