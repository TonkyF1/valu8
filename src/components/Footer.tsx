import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border/40 mt-12">
      <div className="container py-6 flex flex-col items-center text-center gap-4">
        <Logo size="sm" />
        <p className="text-[11px] text-muted-foreground/70 max-w-sm leading-relaxed">
          Premium AI car valuations, built for UK private sellers. Test mode — all features free.
        </p>
        <nav className="flex items-center gap-4 text-[11px] text-muted-foreground/80">
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <span className="opacity-30">·</span>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <span className="opacity-30">·</span>
          <Link to="/disclaimers" className="hover:text-primary transition-colors">Disclaimers</Link>
        </nav>
        <div className="text-[10px] text-muted-foreground/50">
          <p>© {new Date().getFullYear()} Valu8</p>
          <p className="mt-0.5">AI estimates only. Not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
