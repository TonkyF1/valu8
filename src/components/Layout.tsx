import { useEffect, useState } from "react";
import { Link, NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeftRight, BookOpen, Car as CarIcon, HelpCircle, Info, LayoutDashboard, ListChecks, Menu, Plus, SearchCheck, UserCircle2, Tag } from "lucide-react";
import "@/styles/tesla.css";
import { Logo } from "@/components/Logo";
import { HomeLink, START_PATH } from "@/components/HomeLink";
import { cn } from "@/lib/utils";

/** Former top strip. Kept as a no-op export so existing page imports keep working;
 *  the "live data" claim now lives in context (with "where available") instead of on every page. */
export function TestModeBanner() {
  return null;
}

type Item = { to: string; label: string; icon: typeof CarIcon };

const PUBLIC_NAV: Item[] = [
  { to: START_PATH, label: "Value a car", icon: CarIcon },
  { to: "/check", label: "Check an advert", icon: SearchCheck },
  { to: "/how-it-works", label: "How it works", icon: ListChecks },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

/** Extra links that only live in the mobile burger menu (the desktop bar and footer stay uncrowded). */
const MORE_NAV: Item[] = [
  { to: "/how-it-works", label: "How it works", icon: ListChecks },
  { to: "/car-values", label: "Car values", icon: CarIcon },
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
              <SheetContent side="right" className="t8p-menu !w-full !max-w-none !border-0 flex flex-col gap-0 p-0 bg-[#111111] text-[#F7F5F3] sm:!max-w-none">
                <SheetHeader className="px-6 pt-5 pb-3 text-left">
                  <SheetTitle><HomeLink aria-label="Valu8 home" onClick={() => setOpen(false)}><Logo size="sm" /></HomeLink></SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
                  {user && (
                    <HomeLink focusReg onClick={() => setOpen(false)}>New valuation</HomeLink>
                  )}
                  {items.map(({ to, label }) => to === START_PATH ? (
                    <HomeLink key={to} focusReg onClick={() => setOpen(false)}>{label}</HomeLink>
                  ) : (
                    <RouterNavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</RouterNavLink>
                  ))}
                  {/* To add later: "How it works" is already linked; more pages go in MORE_NAV above. */}
                  <p className="mt-9 mb-1 text-[11px] font-medium uppercase tracking-[.2em] text-[#8A8A8A]">More</p>
                  {MORE_NAV.filter((m) => !items.some((i) => i.to === m.to)).map(({ to, label }) => (
                    <RouterNavLink key={to} to={to} onClick={() => setOpen(false)}>{label}</RouterNavLink>
                  ))}
                </nav>
                <div className="px-6 pb-8 pt-4 border-t border-white/10">
                  {user ? (
                    <Link to="/profile" onClick={() => setOpen(false)} className="small !flex items-center gap-3 text-[15px] text-[#ADADAD] hover:text-white min-h-[44px]">
                      <UserCircle2 className="h-5 w-5" aria-hidden /> Profile &amp; settings
                    </Link>
                  ) : (
                    <Link to="/auth" onClick={() => setOpen(false)} className="t8p-pill !flex w-full">Sign in</Link>
                  )}
                  <p className="mt-4 text-xs text-[#8A8A8A]">Essentials free. Full seller report £2.99 one-off.</p>
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


/** Long content pages that get the small bottom "Value a car" bar on phones. Not the home page, the flow, the dashboard or app screens. */
const STICKY_PREFIXES = ["/guides", "/about", "/contact", "/pricing", `/${"accuracy"}`, "/how-it-works", "/faq", "/example-report", "/value", "/car-values"];

export function showsStickyCta(pathname: string): boolean {
  return STICKY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Phone-only bar, shown once the reader has scrolled a little and hidden again near the footer so it never covers links. */
function StickyValueCta() {
  const { pathname } = useLocation();
  const on = showsStickyCta(pathname);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!on) { setVisible(false); return; }
    const check = () => {
      const y = window.scrollY, h = document.documentElement.scrollHeight, vh = window.innerHeight;
      setVisible(y > 500 && h - (y + vh) > 360);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => { window.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [on, pathname]);
  if (!on) return null;
  return (
    <div
      data-testid="sticky-cta"
      aria-hidden={!visible}
      className={cn(
        "md:hidden fixed left-1/2 z-30 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 pointer-events-none",
      )}
    >
      <HomeLink focusReg tabIndex={visible ? 0 : -1} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-[#111111]/85 px-6 text-[13px] font-medium tracking-wide text-[#F7F5F3] shadow-[0_8px_30px_rgba(0,0,0,.5)] backdrop-blur-xl">
        Value a car <span className="text-[#00D6C8]" aria-hidden>→</span>
      </HomeLink>
    </div>
  );
}
