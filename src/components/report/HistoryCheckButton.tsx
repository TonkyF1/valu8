import { ExternalLink, FileSearch } from "lucide-react";

/** Official affiliate link format from carVertical. Plain link: no redirect, wrapper, masking, shortener or iframe. */
export const HISTORY_CHECK_URL = "https://www.carvertical.deal/4BZC6ZM/5DKLH2/?uid=22&source_id=AFF&sub1=valu8";

/** Affiliate link plus the viewed car's reg (uppercased, whitespace stripped, URL-encoded) as sub3. No reg: no sub3. */
export function historyCheckHref(registration?: string | null): string {
  const reg = (registration ?? "").toUpperCase().replace(/\s+/g, "");
  return reg ? `${HISTORY_CHECK_URL}&sub3=${encodeURIComponent(reg)}` : HISTORY_CHECK_URL;
}
export const HISTORY_CHECK_DISCLOSURE = "Affiliate link: Valu8 earns a commission if you buy.";

/** "Full vehicle history check" via carVertical, with the required affiliate disclosure next to the button. */
export function HistoryCheckButton({ registration }: { registration?: string | null } = {}) {
  return (
    <section className="mt-6 rounded-xl border border-border/50 bg-card/40 p-4" data-testid="history-check">
      <p className="text-sm font-medium text-foreground">Want the full history behind this car?</p>
      <p className="text-xs text-muted-foreground mt-1">A paid history check can show things MOT records don't, such as outstanding finance, write-off status and mileage records.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={historyCheckHref(registration)}
          target="_blank"
          rel="sponsored noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
        >
          <FileSearch className="h-4 w-4" aria-hidden />
          Full vehicle history check
          <span className="font-normal text-primary/80">via carVertical</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        <p className="text-xs text-muted-foreground" data-testid="history-check-disclosure">{HISTORY_CHECK_DISCLOSURE}</p>
      </div>
    </section>
  );
}
