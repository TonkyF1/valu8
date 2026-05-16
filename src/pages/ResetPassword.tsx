import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TestModeBanner, Header } from "@/components/Layout";
import { toast } from "sonner";
import { Lock, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Reset password — Valu8";
    // Supabase puts the recovery token in the URL hash; getSession picks it up.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Listen briefly for the PASSWORD_RECOVERY event fired after parsing the hash.
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" || session) setReady(true);
        });
        setTimeout(() => sub.subscription.unsubscribe(), 4000);
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 grid place-items-center px-4 py-12 hero-glow">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-primary items-center justify-center shadow-glow mb-4">
              <KeyRound className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {ready ? "Choose a strong password you'll remember." : "Verifying your reset link…"}
            </p>
          </div>

          {ready && (
            <form onSubmit={submit} className="premium-card p-6 sm:p-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="pw" type="password" autoComplete="new-password" required minLength={8}
                    className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="pw2" type="password" autoComplete="new-password" required minLength={8}
                    className="pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password" />
                </div>
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
