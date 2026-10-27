import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "already" | "done" | "invalid" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "loading" : "invalid");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Unsubscribe — Valu8";
    if (!token) return;
    supabase.functions.invoke("email-unsubscribe", { body: { token, action: "check" } })
      .then(({ data, error }) => setState(error ? "invalid" : (data?.status as State) ?? "invalid"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("email-unsubscribe", { body: { token } });
    setBusy(false);
    setState(error ? "error" : data?.status === "done" ? "done" : "error");
  };

  const copy: Record<State, { h: string; p: string }> = {
    loading: { h: "Checking your link…", p: "" },
    valid: { h: "Unsubscribe from Valu8 emails?", p: "You'll stop getting report and follow-up emails from us. You can still use Valu8 as normal." },
    already: { h: "You're already unsubscribed", p: "We won't send you any more emails." },
    done: { h: "You've been unsubscribed", p: "We won't send you any more emails. Changed your mind? Turn emails back on in your account settings." },
    invalid: { h: "This link isn't valid", p: "It may be incomplete. Try the link from your latest email, or reply to it and we'll sort it." },
    error: { h: "Something went wrong", p: "Please try again in a moment." },
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container max-w-lg py-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4">
          <h1 className="text-2xl font-semibold">{copy[state].h}</h1>
          {copy[state].p && <p className="text-muted-foreground">{copy[state].p}</p>}
          {(state === "valid" || state === "error") && (
            <Button className="min-h-[44px]" disabled={busy} onClick={confirm}>{busy ? "Unsubscribing…" : "Unsubscribe"}</Button>
          )}
          {state !== "valid" && state !== "loading" && <Link to="/" className="text-sm text-primary underline">Back to Valu8</Link>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
