import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { cleanPath, ev, flush } from "@/lib/analytics";

const kindOf = (p: string) =>
  p.startsWith("/faq") ? "faq" : p.startsWith("/guides") ? "guide" : p.startsWith("/value") || p.startsWith("/car-values") ? "value"
  : p.startsWith("/how-it-works") ? "how_it_works" : p.startsWith("/example-report") ? "example_report"
  : p.startsWith("/check") ? "check" : p.startsWith("/pricing") ? "pricing" : "other";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/**
 * Anonymous, cookieless usage analytics (see src/lib/analytics.ts): page views on route changes, time on page,
 * scroll depth, which sections were seen, and clicks on outbound links and key internal links.
 * Renders nothing and stores nothing on the device.
 */
export function SiteAnalytics() {
  const location = useLocation();
  const pv = useRef(0);
  const first = useRef(true);
  const prevPath = useRef<string | null>(null);
  const visibleSince = useRef<number | null>(null);
  const seconds = useRef(0);
  const maxScroll = useRef(0);
  const sent = useRef<Set<string>>(new Set());
  const pathRef = useRef("/");

  const reportTime = () => {
    if (visibleSince.current != null) { seconds.current += (Date.now() - visibleSince.current) / 1000; visibleSince.current = document.visibilityState === "visible" ? Date.now() : null; }
    if (seconds.current >= 1) ev("page_time", { seconds: Math.round(seconds.current), pv: pv.current }, pathRef.current);
  };

  // Page views on route change (the first one is the landing).
  const path = cleanPath(location.pathname);
  useEffect(() => {
    if (prevPath.current !== null) reportTime();
    pathRef.current = path; pv.current += 1; seconds.current = 0; maxScroll.current = 0; sent.current = new Set();
    visibleSince.current = document.visibilityState === "visible" ? Date.now() : null;
    ev("page_view", { pv: pv.current, entry: first.current, from: prevPath.current ?? undefined }, path);
    first.current = false; prevPath.current = path;

    // Sections seen: headings and [data-section] blocks, once each per page view.
    const seen = new Set<string>();
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        const id = el.getAttribute("data-section") || slug(el.textContent || "");
        if (id && !seen.has(id) && seen.size < 40) { seen.add(id); ev("section_view", { id }, pathRef.current); }
        io!.unobserve(el);
      }
    }, { threshold: 0.4 }) : null;
    const watched = new WeakSet<Element>();
    const scan = () => document.querySelectorAll("main h2, [data-section]").forEach((el) => { if (!watched.has(el)) { watched.add(el); io?.observe(el); } });
    const timers = [600, 2000, 5000].map((ms) => setTimeout(scan, ms));
    return () => { timers.forEach(clearTimeout); io?.disconnect(); };
  }, [path]);

  // Scroll depth (25/50/75/100), time on page, outbound/internal link clicks.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement.scrollHeight;
        if (h <= 0) return;
        const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100));
        if (pct > maxScroll.current) maxScroll.current = pct;
        for (const t of [25, 50, 75, 100]) if (pct >= t && !sent.current.has(`s${t}`)) { sent.current.add(`s${t}`); ev("scroll_depth", { pct: t, pv: pv.current }, pathRef.current); }
      });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") { reportTime(); visibleSince.current = null; flush(); }
      else visibleSince.current = Date.now();
    };
    const onHide = () => { reportTime(); flush(); };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      try {
        const u = new URL(a.href, window.location.href);
        const area = a.closest("header") ? "header" : a.closest("footer") ? "footer" : "page";
        if (u.protocol === "mailto:" || u.protocol === "tel:") return;
        if (u.hostname !== window.location.hostname) { ev("outbound_click", { domain: u.hostname.replace(/^www\./, ""), area }, pathRef.current); return; }
        const to = cleanPath(u.pathname);
        const kind = kindOf(to);
        if (kind !== "other" || area !== "page") ev("nav_click", { to, kind, area }, pathRef.current);
      } catch { /* ignore */ }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide); document.removeEventListener("click", onClick, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}

