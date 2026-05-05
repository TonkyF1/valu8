import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestModeBanner, Header } from "@/components/Layout";
import { toast } from "sonner";
import { Gauge, Mail, Lock, Sparkles } from "lucide-react";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Min 8 characters").max(72);

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Sign in — Valu8"; }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailOk = emailSchema.safeParse(email);
    if (!emailOk.success) return toast.error(emailOk.error.issues[0].message);
    const pwOk = passwordSchema.safeParse(password);
    if (!pwOk.success) return toast.error(pwOk.error.issues[0].message);

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Welcome to Valu8");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setBusy(false); }
  };

  const magicLink = async () => {
    const ok = emailSchema.safeParse(email);
    if (!ok.success) return toast.error("Enter your email first");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Check your inbox for a magic link");
    } catch (err: any) {
      toast.error(err.message || "Couldn't send link");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main className="flex-1 grid place-items-center px-4 py-12 hero-glow">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-primary items-center justify-center shadow-glow mb-4">
              <Gauge className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Valu8</h1>
            <p className="text-muted-foreground mt-2">Premium AI valuations, built for UK private sellers.</p>
          </div>

          <div className="premium-card p-6 sm:p-8">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" autoComplete="email" required
                      className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required className="pl-9" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters" />
                  </div>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground tracking-wider">or</span>
                </div>
              </div>

              <Button type="button" variant="premium" size="lg" className="w-full" onClick={magicLink} disabled={busy}>
                <Sparkles className="h-4 w-4 text-primary" /> Email me a magic link
              </Button>
            </Tabs>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing you agree to our terms. Test mode — no payment required.
          </p>
        </div>
      </main>
    </div>
  );
}
