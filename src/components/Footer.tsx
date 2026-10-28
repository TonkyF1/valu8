import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { resetConsent } from "@/lib/consent";

const COLS: { title: string; links: { to: string; label: string }[] }[] = [
  { title: "Product", links: [
    { to: "/valuation/new", label: "Value my car" },
    { to: "/check", label: "Check an advert" },
    { to: "/pricing", label: "Pricing" },
    { to: "/accuracy", label: "Accuracy" },
  ] },
  { title: "Guides", links: [
    { to: "/guides", label: "Guides" },
    { to: "/car-values", label: "Car values by model" },
    { to: "/about", label: "About & contact" },
  ] },
  { title: "Legal", links: [
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
    { to: "/disclaimers", label: "Disclaimers" },
  ] },
];

/** Directory badges. Twelve Tools needs a followable link (no nofollow) for its free listing. */
const BADGES: { href: string; src?: string; label: string; w: number; h: number }[] = [
  { href: "https://twelve.tools", src: "https://twelve.tools/badge0-dark.svg", label: "Featured on Twelve Tools", w: 200, h: 54 },
  { href: "https://fazier.com", src: "https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=dark", label: "Featured on Fazier", w: 182, h: 43 },
  { href: "https://startupbase.io", label: "StartupBase", w: 0, h: 0 },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-16 bg-card/40">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Independent car valuations for UK private sellers and buyers. Free during early access.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{c.title}</h2>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="inline-flex min-h-[36px] items-center text-sm text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>
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
        <nav className="container py-4 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Directory listings">
          <span className="text-xs text-muted-foreground">Find us on</span>
          {BADGES.map((b) => (
            <a
              key={b.href}
              href={b.href}
              target="_blank"
              rel="noopener"
              title={b.label}
              className="inline-flex h-7 items-center opacity-70 hover:opacity-100 transition-opacity"
            >
              {b.src ? (
                <img src={b.src} alt={b.label} width={b.w} height={b.h} loading="lazy" className="h-7 w-auto" />
              ) : (
                <span className="inline-flex h-7 items-center rounded-md border border-border/60 px-2.5 text-xs font-semibold text-foreground/80">
                  <span className="mr-1 font-normal text-muted-foreground">Featured on</span>{b.label}
                </span>
              )}
            </a>
          ))}
        </nav>
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
