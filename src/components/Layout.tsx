import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, LogOut, Plus, UserCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export function TestModeBanner() {
  return (
    <div className="w-full h-6 flex items-center justify-center bg-muted/40 border-b border-border/60 text-muted-foreground text-[10.5px] tracking-[0.12em] uppercase">
      <span className="font-medium text-foreground/70">Test mode</span>
      <span className="mx-2 opacity-40">·</span>
      <span>Guidance only, not financial advice</span>
    </div>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const onDash = location.pathname.startsWith("/dashboard");

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center group" aria-label="Valu8 home">
          <Logo className="transition-transform group-hover:scale-[1.02]" />
        </Link>

        <nav className="flex items-center gap-1.5">
          {user ? (
            <>
              <Button variant="hero" size="sm" onClick={() => navigate("/valuation/new")}>
                <Plus className="h-4 w-4" /> New valuation
              </Button>
              {!onDash && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="hidden sm:inline-flex">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Dashboard" className="sm:hidden">
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} aria-label="Profile">
                <UserCircle2 className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
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
