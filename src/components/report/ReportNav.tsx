import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Report sections that can be jumped to. Only sections present in the DOM are shown. */
export const REPORT_SECTIONS = [
  { id: "r-summary", label: "Summary" },
  { id: "r-price", label: "Price" },
  { id: "r-details", label: "Details" },
  { id: "r-mot", label: "MOT" },
  { id: "r-ownership", label: "Ownership" },
  { id: "sale-feedback", label: "Sold it?" },
  { id: "advert", label: "Advert" },
] as const;

/** `deps` should change whenever the set of rendered sections may change. */
export function useReportSections(ready: boolean, deps = "") {
  const [present, setPresent] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const ids = REPORT_SECTIONS.map((s) => s.id).filter((id) => document.getElementById(id));
    setPresent(ids);
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ready, deps]);
  return { sections: REPORT_SECTIONS.filter((s) => present.includes(s.id)), active };
}

type Props = { sections: readonly { id: string; label: string }[]; active: string | null; variant: "chips" | "sidebar" };

export function ReportNav({ sections, active, variant }: Props) {
  if (sections.length < 2) return null;
  if (variant === "chips") {
    return (
      <nav aria-label="Report sections" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pt-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === s.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </a>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Report sections" className="sticky top-24 space-y-0.5 border-l border-border/60">
      <p className="pl-4 pb-2 text-xs font-semibold text-foreground/80">On this page</p>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={cn(
            "-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors",
            active === s.id ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/** Owner-only prompt near the price; the full form lives further down (#sale-feedback). Real sale prices keep Valu8 honest. */
export function SoldItPrompt() {
  return (
    <a
      href="#sale-feedback"
      className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-primary/50 bg-primary/10 px-5 py-4 hover:border-primary transition-colors"
    >
      <span>
        <span className="block text-base font-semibold">Sold it? What did you get?</span>
        <span className="block text-sm text-muted-foreground mt-0.5">Tell us the price (takes 10 seconds). Real sale prices are how we keep every valuation honest.</span>
      </span>
      <span className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-4 min-h-[44px]">Add sale price</span>
    </a>
  );
}
