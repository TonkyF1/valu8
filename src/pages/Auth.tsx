import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
  <svg viewBox="0 0 24 24" width="16" height="16" {...props}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 7.1 29.3 5 24 5c-7.6 0-14.1 4.3-17.7 9.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.6 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z" />
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
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
                className="w-full mb-4"
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
