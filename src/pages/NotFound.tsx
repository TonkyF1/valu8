import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  const location = useLocation();
  useEffect(() => {
    document.title = "Page not found — Valu8";
    console.warn("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background hero-glow">
      <header className="container py-6">
        <Link to="/" aria-label="Valu8 home"><Logo /></Link>
      </header>
      <main className="flex-1 grid place-items-center px-4 pb-16">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-primary/15 text-primary items-center justify-center mb-6">
            <Compass className="h-7 w-7" />
          </div>
          <div className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-2">404</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gradient mb-3">
            We couldn't find that page
          </h1>
          <p className="text-muted-foreground text-sm md:text-base mb-8">
            The link may be broken, or the page may have moved. Let's get you back on track.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild variant="hero" size="lg">
              <Link to="/dashboard"><Home className="h-4 w-4" /> Back to dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link to="/valuation/new">New valuation</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
