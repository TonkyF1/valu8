import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestModeBanner, Header } from "@/components/Layout";
import { toast } from "sonner";
import { Gauge, Mail, Lock, Sparkles } from "lucide-react";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Min 8 characters").max(72);

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => { document.title = "Sign in — Valu8"; }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const emailOk = emailSchema.safeParse(email);
    if (!emailOk.success) next.email = emailOk.error.issues[0].message;
    const pwOk = passwordSchema.safeParse(password);
    if (!pwOk.success) next.password = pwOk.error.issues[0].message;
    setErrors(next);
    if (Object.keys(next).length) return;

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
    if (!ok.success) { setErrors({ email: "Enter your email first" }); return; }
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

  const forgotPassword = async () => {
    const ok = emailSchema.safeParse(email);
    if (!ok.success) { setErrors({ email: "Enter your email first" }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset link sent");
    } catch (err: any) {
      toast.error(err.message || "Couldn't send reset link");
    } finally { setBusy(false); }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Couldn't sign in with Google");
      setBusy(false);
    }
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
            <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setErrors({}); }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full mb-4 gap-2.5 bg-card hover:bg-muted/60 border-border/80 hover:border-primary/40 transition-colors"
                onClick={signInWithGoogle}
                disabled={busy}
              >
                <GoogleIcon /> Continue with Google
              </Button>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground tracking-wider">or with email</span>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" autoComplete="email" required
                      aria-invalid={!!errors.email}
                      className={`pl-9 ${errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({ ...s, email: undefined })); }}
                      placeholder="you@example.com" />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={forgotPassword}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      aria-invalid={!!errors.password}
                      className={`pl-9 ${errors.password ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(s => ({ ...s, password: undefined })); }}
                      placeholder="At least 8 characters" />
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
                </Button>

                <button
                  type="button"
                  onClick={magicLink}
                  disabled={busy}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5 pt-1"
                >
                  <Sparkles className="h-3 w-3" /> Or email me a magic link instead
                </button>
              </form>
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
