import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, BookOpen, HelpCircle, Info, LayoutDashboard, ListChecks, Menu, Plus, SearchCheck, UserCircle2, Tag, Car } from "lucide-react";
import { Logo } from "@/components/Logo";
import { HomeLink, START_PATH } from "@/components/HomeLink";
import { cn } from "@/lib/utils";

/** Former top strip. Kept as a no-op export so existing page imports keep working;
 *  the "live data" claim now lives in context (with "where available") instead of on every page. */
export function TestModeBanner() {
  return null;
}

type Item = { to: string; label: string; icon: typeof Car };

const PUBLIC_NAV: Item[] = [
  { to: START_PATH, label: "Value a car", icon: Car },
  { to: "/check", label: "Check an advert", icon: SearchCheck },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

const MORE_NAV: Item[] = [
  { to: "/how-it-works", label: "How it works", icon: ListChecks },
  { to: "/value", label: "Car values", icon: Car },
  { to: "/guides", label: "Guides", icon: BookOpen },
  { to: "/faq", label: "FAQ", icon: HelpCircle },
  { to: "/about", label: "About", icon: Info },
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
  const onNew = pathname === START_PATH || pathname.startsWith("/valuation/new");

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
          <HomeLink className="flex items-center shrink-0" aria-label="Valu8 home" data-testid="logo-home">
            <Logo />
          </HomeLink>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1 ml-4">
            {items.filter((i) => user || i.to !== START_PATH).map((i) => (
              <RouterNavLink key={i.to} to={i.to} className={linkCls}>{i.label}</RouterNavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                {!onNew && (
                  <Button asChild variant="hero" size="sm" className="hidden sm:inline-flex">
                    <HomeLink focusReg><Plus className="h-4 w-4" aria-hidden /> New valuation</HomeLink>
                  </Button>
                )}
                <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Profile">
                  <Link to="/profile"><UserCircle2 className="h-5 w-5" /></Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
                <Button asChild variant="hero" size="sm"><HomeLink focusReg data-testid="nav-value-a-car">Value a car</HomeLink></Button>
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
                  <SheetTitle><HomeLink aria-label="Valu8 home" onClick={() => setOpen(false)}><Logo size="sm" /></HomeLink></SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                  {user && (
                    <HomeLink focusReg onClick={() => setOpen(false)} className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                      <Plus className="h-4 w-4" aria-hidden /> New valuation
                    </HomeLink>
                  )}
                  {items.map(({ to, label, icon: Icon }) => to === START_PATH ? (
                    <HomeLink key={to} focusReg onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                      <Icon className="h-4 w-4 text-primary" aria-hidden /> {label}
                    </HomeLink>
                  ) : (
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
                  <div className="my-2 border-t border-border/60" />
                  {MORE_NAV.filter((m) => !items.some((i) => i.to === m.to)).map(({ to, label, icon: Icon }) => (
                    <RouterNavLink key={to} to={to} onClick={() => setOpen(false)}
                      className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-colors", isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
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
                  <p className="mt-3 px-3 text-xs text-muted-foreground">Essentials free. Full seller report £2.99 one-off.</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <StickyValueCta />
    </>
  );
}

/** Long content pages that get the small bottom "Value a car" pill on phones. Not home, the flow, the dashboard or app screens. */
const STICKY_PREFIXES = ["/guides", "/about", "/contact", "/pricing", `/${"accuracy"}`, "/how-it-works", "/faq", "/example-report", "/value", "/car-values"];

export function showsStickyCta(pathname: string): boolean {
  return STICKY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Phone-only pill: appears after a little scrolling and hides near the footer so it never covers links. */
function StickyValueCta() {
  const { pathname } = useLocation();
  const on = showsStickyCta(pathname);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!on) { setVisible(false); return; }
    const check = () => {
      const y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(y > 500 && h - y > 360);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => { window.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [on, pathname]);
  if (!on) return null;
  return (
    <div data-testid="sticky-cta" aria-hidden={!visible}
      className={cn("md:hidden fixed left-1/2 -translate-x-1/2 z-30 bottom-[max(16px,env(safe-area-inset-bottom))] transition-all duration-300", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")}>
      <HomeLink focusReg tabIndex={visible ? 0 : -1} className={cn(buttonVariants({ variant: "hero", size: "sm" }), "rounded-full px-5 min-h-[44px]")}>
        <Car className="h-4 w-4" aria-hidden /> Value a car
      </HomeLink>
    </div>
  );
}
