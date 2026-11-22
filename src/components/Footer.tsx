import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { HomeLink, START_PATH } from "@/components/HomeLink";
import { resetConsent } from "@/lib/consent";

const COLS: { title: string; links: { to: string; label: string }[] }[] = [
  { title: "Product", links: [
    { to: START_PATH, label: "Value a car" },
    { to: "/check", label: "Check an advert" },
    { to: "/pricing", label: "Pricing" },
    { to: "/how-it-works", label: "How it works" },
  ] },
  { title: "Guides", links: [
    { to: "/guides", label: "Guides" },
    { to: "/value", label: "Car values by model" },
    { to: "/example-report", label: "Example report" },
    { to: "/faq", label: "FAQ" },
    { to: "/embed-info", label: "Free valuation box for your site" },
    { to: "/about", label: "About & contact" },
  ] },
  { title: "Legal", links: [
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
    { to: "/disclaimers", label: "Disclaimers" },
  ] },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-16 bg-card/40">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <HomeLink aria-label="Valu8 home" className="inline-flex" data-testid="footer-logo-home"><Logo size="sm" /></HomeLink>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Independent car valuations for UK private sellers and buyers. Essentials free; Full seller report £2.99 one-off.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{c.title}</h2>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.to}>
                  {l.to === START_PATH
                    ? <HomeLink focusReg className="inline-flex min-h-[36px] items-center text-sm text-muted-foreground hover:text-primary transition-colors">{l.label}</HomeLink>
                    : <Link to={l.to} className="inline-flex min-h-[36px] items-center text-sm text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>}
                </li>
              ))}
              {c.title === "Legal" && (
                <li><button type="button" onClick={resetConsent} className="inline-flex min-h-[36px] items-center text-sm text-muted-foreground hover:text-primary transition-colors">Cookie settings</button></li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border/40">
        <div className="container py-4 flex flex-col sm:flex-row gap-1 justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Valu8</p>
          <p>Estimates only, not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
