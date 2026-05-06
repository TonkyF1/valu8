import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, LogOut, Plus } from "lucide-react";
import valu8Logo from "@/assets/valu8-logo.png";

export function TestModeBanner() {
  return (
    <div className="w-full bg-gradient-primary text-primary-foreground text-[11px] sm:text-xs font-medium tracking-wide py-2 px-4 text-center">
      <span className="font-bold">TEST MODE</span>
      <span className="opacity-80 mx-2">•</span> Full Report Unlocked
      <span className="opacity-80 mx-2">•</span> AI-powered valuations
      <span className="opacity-80 mx-2 hidden sm:inline">•</span>
      <span className="hidden sm:inline">Not financial advice</span>
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
          <img
            src={valu8Logo}
            alt="Valu8"
            className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.03]"
          />
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {!onDash && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="hidden sm:inline-flex">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Button>
              )}
              <Button variant="hero" size="sm" onClick={() => navigate("/valuation/new")}>
                <Plus className="h-4 w-4" /> New valuation
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
