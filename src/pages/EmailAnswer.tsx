import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Landing page for the one-tap answers in follow-up emails ("Still looking", "Didn't buy it", "Not sold yet").
// The answer is recorded by a POST from this page (never by the GET of the email link), so link scanners can't answer.
type Answer = "still_looking" | "not_bought" | "not_sold";
type State = "saving" | "ok" | "already" | "invalid" | "error";

const THANKS: Record<Answer, { h: string; p: string }> = {
  still_looking: { h: "Thanks — good luck with the search", p: "We'll check in again in a couple of weeks. When you find the right car, run the advert through Valu8 first." },
  not_bought: { h: "Thanks for letting us know", p: "We won't ask about that car again. If you're still searching, Valu8 can check the next advert in seconds." },
  not_sold: { h: "Thanks — we'll check back later", p: "We'll ask again in a couple of weeks. Your valuation is saved in your account whenever you need it." },
};

export default function EmailAnswer() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>(token ? "saving" : "invalid");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const sent = useRef(false);

  const record = async () => {
    setState("saving");
    const { data, error } = await supabase.functions.invoke("email-answer", { body: { token } });
    if (data?.answer) setAnswer(data.answer as Answer);
    if (error) setState("invalid");
    else setState(data?.status === "ok" ? "ok" : data?.status === "already" ? "already" : "error");
  };

  useEffect(() => {
    document.title = "Thanks — Valu8";
    if (!token || sent.current) return;
    sent.current = true;
    void record();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const copy =
    state === "saving" ? { h: "Saving your answer…", p: "" }
    : state === "ok" && answer ? THANKS[answer]
    : state === "ok" ? { h: "Thanks — got it", p: "Your answer has been saved." }
    : state === "already" ? { h: "Thanks — we already have your answer", p: "You've already told us how this one went, so there's nothing more to do." }
    : state === "invalid" ? { h: "This link isn't valid any more", p: "It may be old or incomplete. Just reply to the email and tell us how it went." }
    : { h: "Something went wrong", p: "Please try again in a moment." };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main id="main" className="flex-1 container max-w-lg py-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4" aria-live="polite">
          <h1 className="text-2xl font-semibold">{copy.h}</h1>
          {copy.p && <p className="text-muted-foreground">{copy.p}</p>}
          {state === "error" && <Button className="min-h-[44px]" onClick={record}>Try again</Button>}
          {state !== "saving" && (
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild variant="hero" className="min-h-[44px]"><Link to={answer === "not_sold" ? "/dashboard" : "/check"}>{answer === "not_sold" ? "Go to my account" : "Check an advert"}</Link></Button>
              <Link to="/" className="self-center text-sm text-primary underline">Back to Valu8</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
