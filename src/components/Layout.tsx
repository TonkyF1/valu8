import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, LayoutDashboard, Plus, Scale, UserCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export function TestModeBanner() {
  return (
    <div className="w-full h-6 flex items-center justify-center bg-muted/30 border-b border-border/40 text-muted-foreground/70 text-[10px] tracking-[0.14em] uppercase">
      <span className="font-medium">Powered by live UK market data</span>
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const onDash = path.startsWith("/dashboard");
  const onProfile = path.startsWith("/profile");
  const onNew = path.startsWith("/valuation/new");

  const logoHref = user ? "/dashboard" : "/";

  return (
    <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={logoHref} className="flex items-center group" aria-label="Valu8 home">
          <Logo className="transition-transform group-hover:scale-[1.02]" />
        </Link>
        <span className="ml-2 mr-auto hidden sm:inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary" title="All features are free during early access">
          Early access: free
        </span>

        <nav aria-label="Main" className="flex items-center gap-1.5">
          {user ? (
            <>
              {!onNew && (
                <Button variant="hero" size="sm" onClick={() => navigate("/valuation/new")}>
                  <Plus className="h-4 w-4" /> New valuation
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                aria-current={onDash ? "page" : undefined}
                className={cn(
                  "hidden sm:inline-flex relative",
                  onDash && "text-foreground bg-muted/50"
                )}
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                aria-label="Dashboard"
                aria-current={onDash ? "page" : undefined}
                className={cn("sm:hidden", onDash && "text-foreground bg-muted/50")}
              >
                <LayoutDashboard className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => navigate("/buyer")} aria-current={path === "/buyer" ? "page" : undefined}>
                <Scale className="h-4 w-4" aria-hidden /> Buyer check
              </Button>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => navigate("/compare")} aria-current={path === "/compare" ? "page" : undefined}>
                <ArrowLeftRight className="h-4 w-4" aria-hidden /> Compare
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
                aria-label="Profile"
                aria-current={onProfile ? "page" : undefined}
                className={cn(onProfile && "text-foreground bg-muted/50")}
              >
                <UserCircle2 className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/buyer")}>Buyers</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>Get started</Button>
            </>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}
