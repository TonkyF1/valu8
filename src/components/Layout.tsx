import { useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, LayoutDashboard, Menu, Plus, SearchCheck, UserCircle2, Tag, ShieldCheck, Car } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

/** Former top strip. Kept as a no-op export so existing page imports keep working;
 *  the "live data" claim now lives in context (with "where available") instead of on every page. */
export function TestModeBanner() {
  return null;
}

type Item = { to: string; label: string; icon: typeof Car };

const PUBLIC_NAV: Item[] = [
  { to: "/valuation/new", label: "Value my car", icon: Car },
  { to: "/check", label: "Check an advert", icon: SearchCheck },
  { to: "/pricing", label: "Pricing", icon: Tag },
  { to: "/accuracy", label: "Accuracy", icon: ShieldCheck },
];

const USER_NAV: Item[] = [
  { to: "/dashboard", label: "My valuations", icon: LayoutDashboard },
  { to: "/check", label: "Check an advert", icon: SearchCheck },
  { to: "/compare", label: "Compare", icon: ArrowLeftRight },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

export function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const items = user ? USER_NAV : PUBLIC_NAV;
  const onNew = pathname.startsWith("/valuation/new");

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive ? "text-foreground bg-muted/60" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="container flex h-16 items-center gap-4">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center shrink-0" aria-label="Valu8 home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1 ml-4">
            {items.filter((i) => user || i.to !== "/valuation/new").map((i) => (
              <RouterNavLink key={i.to} to={i.to} className={linkCls}>{i.label}</RouterNavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                {!onNew && (
                  <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex">
                    <Link to="/valuation/new"><Plus className="h-4 w-4" aria-hidden /> New valuation</Link>
                  </Button>
                )}
                <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Profile">
                  <Link to="/profile"><UserCircle2 className="h-5 w-5" /></Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
                <Button asChild variant="hero" size="sm"><Link to="/valuation/new">Value my car</Link></Button>
              </>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-xs flex flex-col gap-0 p-0">
                <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 text-left">
                  <SheetTitle><Logo size="sm" /></SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  {user && (
                    <Link to="/valuation/new" onClick={() => setOpen(false)} className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                      <Plus className="h-4 w-4" aria-hidden /> New valuation
                    </Link>
                  )}
                  {items.map(({ to, label, icon: Icon }) => (
                    <RouterNavLink
                      key={to}
                      to={to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden /> {label}
                    </RouterNavLink>
                  ))}
                </nav>
                <div className="border-t border-border/60 p-4">
                  {user ? (
                    <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-muted-foreground hover:text-foreground">
                      <UserCircle2 className="h-5 w-5" aria-hidden /> Profile &amp; settings
                    </Link>
                  ) : (
                    <Button asChild variant="outline" className="w-full"><Link to="/auth" onClick={() => setOpen(false)}>Sign in</Link></Button>
                  )}
                  <p className="mt-3 px-3 text-xs text-muted-foreground">All features free during early access.</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
