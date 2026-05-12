import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Plus, UserCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export function TestModeBanner() {
  return (
    <div className="w-full h-6 flex items-center justify-center bg-muted/40 border-b border-border/60 text-muted-foreground text-[10.5px] tracking-[0.12em] uppercase">
      <span className="font-medium text-foreground/70">Powered by live UK market data</span>
      <span className="mx-2 opacity-40">·</span>
      <span>Guidance only, not financial advice</span>
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
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={logoHref} className="flex items-center group" aria-label="Valu8 home">
          <Logo className="transition-transform group-hover:scale-[1.02]" />
        </Link>

        <nav className="flex items-center gap-1.5">
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
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>Get started</Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
