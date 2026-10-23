import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { resetConsent } from "@/lib/consent";
import { CAR_MODELS } from "@/data/carModels";
import { CONTACT_EMAIL } from "@/lib/site";

const POPULAR = CAR_MODELS.filter((m) => ["fiesta", "golf", "corsa", "qashqai", "3-series", "yaris"].includes(m.slug));

export function Footer() {
  return (
    <footer className="border-t border-border/40 mt-12">
      <div className="container py-6 flex flex-col items-center text-center gap-4">
        <Logo size="sm" />
        <p className="text-[11px] text-muted-foreground/70 max-w-sm leading-relaxed">
          AI car valuations for UK private sellers and buyers. All features are free during early access.
        </p>
        <nav aria-label="Popular car values" className="flex flex-wrap justify-center gap-x-3 text-[11px] text-muted-foreground/80">
          {POPULAR.map((m) => (
            <Link key={m.makeSlug + m.slug} to={`/car-values/${m.makeSlug}/${m.slug}`} className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">{m.make} {m.model} value</Link>
          ))}
          <Link to="/car-values" className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">All car values</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground/80">
          <Link to="/privacy" className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">Privacy Policy</Link>
          <span className="opacity-30" aria-hidden>·</span>
          <Link to="/terms" className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">Terms of Service</Link>
          <span className="opacity-30" aria-hidden>·</span>
          <Link to="/disclaimers" className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">Disclaimers</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">Contact</a>
          <span className="opacity-30" aria-hidden>·</span>
          <button type="button" onClick={resetConsent} className="inline-flex min-h-[44px] items-center hover:text-primary transition-colors">Cookie settings</button>
        </nav>
        <div className="text-[10px] text-muted-foreground/50">
          <p>© {new Date().getFullYear()} Valu8</p>
          <p className="mt-0.5">AI estimates only. Not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
