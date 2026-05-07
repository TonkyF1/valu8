import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 mt-20">
      <div className="container py-10 grid gap-8 md:grid-cols-3 items-start">
        <div>
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground mt-3 max-w-xs">
            Premium AI car valuations, built for UK private sellers. Test mode — all features free.
          </p>
        </div>
        <div className="md:justify-self-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Legal</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            <li><Link to="/disclaimers" className="hover:text-primary transition-colors">Disclaimers &amp; Data Sources</Link></li>
          </ul>
        </div>
        <div className="md:justify-self-end text-xs text-muted-foreground md:text-right">
          <p>© {new Date().getFullYear()} Valu8</p>
          <p className="mt-1">AI estimates only. Not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
