import "@/styles/plate.css";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/seo";
import { newPageMeta, setJsonLd } from "./newPageMeta";
import { isPlausibleUkReg, normaliseReg } from "@/lib/registration";
import { CARVERTICAL_LOGO, HISTORY_CHECK_COUPON, historyCheckHref, trackHistoryClick } from "@/components/report/HistoryCheckButton";
import {
  HISTORY_COUPON_NOTE, HISTORY_COVERS, HISTORY_DISCLOSURE_LONG, HISTORY_FAQS, HISTORY_FAQ_JSONLD_ID,
  HISTORY_PAGE_H1, HISTORY_PAGE_INTRO, HISTORY_PAGE_PATH, HISTORY_WHY,
} from "@/data/historyCheckContent";

const META = newPageMeta(HISTORY_PAGE_PATH, {
  title: "Car history check by reg: finance, write-offs & mileage | Valu8",
  description: "Check a used car's history by registration with carVertical: outstanding finance, write-offs, theft records and mileage rollbacks. Use code valu8.",
});

/** Reg box: opens carVertical's check for that car in a new tab (affiliate link, reg as sub3, placement as sub2). */
export function HistoryRegForm({ placement = "history_page_form" }: { placement?: string }) {
  const [reg, setReg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const href = historyCheckHref(reg, placement);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isPlausibleUkReg(reg)) { setErr("Enter a UK registration, like AB12 CDE."); return; }
    setErr(null);
    trackHistoryClick(placement);
    window.open(historyCheckHref(normaliseReg(reg), placement), "_blank", "noopener");
  };
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md" data-testid="history-reg-form" aria-label="Check a car's history">
      <label htmlFor="history-reg" className="mb-3 block text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Enter the registration</label>
      <div className="reg-plate"><div className="reg-plate-inner">
        <div className="reg-plate-badge" aria-hidden><img src="/uk-flag.svg" alt="" /><b>UK</b></div>
        <input id="history-reg" value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="AB12 CDE" autoComplete="off" spellCheck={false}
          maxLength={10} size={1} aria-invalid={!!err} className="reg-plate-input" />
      </div></div>
      {err && <p role="alert" className="mt-3 text-center text-sm text-destructive">{err}</p>}
      <button type="submit" data-href={href} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#F7F5F3] px-5 text-base font-semibold text-[#111] transition-colors hover:bg-white">
        Check this car's history <ArrowUpRight className="h-4 w-4" aria-hidden />
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">Opens carVertical in a new tab. Code <span className="font-semibold text-foreground">{HISTORY_CHECK_COUPON}</span> is applied automatically.</p>
    </form>
  );
}

export default function CarHistoryCheck() {
  useSeo(META);
  useEffect(() => setJsonLd(HISTORY_FAQ_JSONLD_ID, {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: HISTORY_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }), []);
  const href = historyCheckHref(null, "history_page");
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1">
        <header className="container max-w-3xl pt-14 md:pt-20 pb-10 text-center">
          <div className="mb-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>In partnership with</span>
            <img src={CARVERTICAL_LOGO} alt="carVertical" width={130} height={18} style={{ height: 18, width: "auto" }} />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gradient">{HISTORY_PAGE_H1}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">{HISTORY_PAGE_INTRO}</p>
          <div className="mt-10"><HistoryRegForm /></div>
        </header>

        <section className="container max-w-5xl py-12 border-t border-border/60" aria-labelledby="covers-h">
          <h2 id="covers-h" className="text-2xl md:text-3xl font-semibold tracking-tight text-center">What a carVertical check covers</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {HISTORY_COVERS.map(([h, t]) => (
              <li key={h} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div><h3 className="font-semibold">{h}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t}</p></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-muted-foreground">As listed by carVertical. What's in a report depends on the records held for that car.</p>
        </section>

        <section className="container max-w-3xl py-12 border-t border-border/60" aria-labelledby="why-h">
          <h2 id="why-h" className="text-2xl md:text-3xl font-semibold tracking-tight">Why check before you buy</h2>
          <div className="mt-6 space-y-6">
            {HISTORY_WHY.map(([h, t]) => (
              <div key={h}><h3 className="text-lg font-semibold">{h}</h3><p className="mt-1.5 leading-relaxed text-muted-foreground">{t}</p></div>
            ))}
          </div>
        </section>

        <section className="container max-w-3xl py-12 border-t border-border/60 text-center" aria-labelledby="coupon-h">
          <h2 id="coupon-h" className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Coupon code</h2>
          <p className="mt-3 font-mono text-5xl md:text-6xl font-bold tracking-tight text-foreground" data-testid="history-coupon">{HISTORY_CHECK_COUPON}</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{HISTORY_COUPON_NOTE}</p>
          <a href={href} target="_blank" rel="sponsored noopener" onClick={() => trackHistoryClick("history_page")}
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 px-6 text-sm font-semibold text-foreground hover:border-white/40">
            Go to carVertical <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </section>

        <section className="container max-w-3xl py-12 border-t border-border/60" aria-labelledby="hfaq-h">
          <h2 id="hfaq-h" className="text-2xl md:text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 divide-y divide-border">
            {HISTORY_FAQS.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-medium">{f.q}<span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container max-w-3xl py-12 border-t border-border/60 text-center" aria-labelledby="price-h">
          <h2 id="price-h" className="text-2xl md:text-3xl font-semibold tracking-tight">Know the price too</h2>
          <p className="mt-3 text-muted-foreground">History tells you what it's been through. Valu8 tells you what it's worth.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/" className="inline-flex min-h-[48px] items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground">Free valuation by reg</Link>
            <Link to="/check" className="inline-flex min-h-[48px] items-center rounded-xl border border-white/15 px-6 text-sm font-semibold">Check an advert's price</Link>
          </div>
          <p className="mx-auto mt-10 max-w-xl text-xs text-muted-foreground" data-testid="history-check-disclosure">{HISTORY_DISCLOSURE_LONG}</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
