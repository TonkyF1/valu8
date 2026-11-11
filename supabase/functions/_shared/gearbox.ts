// gb-1 (2026-11-11, after G6WLN): the free DVSA lookup has no gearbox, and a blank gearbox used to be priced as a MANUAL
// (pm-1 gear=0, own-comps auto=0 plus a 0.3 mismatch weight on every automatic comp). A 2019 BMW X3 (98% of our
// 2017-22 X3 adverts are automatic) came out at £13,200 instead of ~£20,300.
// Fix: when the gearbox is blank, take the dominant gearbox for that make/model/year from our own adverts if it holds
// at least DOMINANT_SHARE of them; otherwise keep it unknown and pass the automatic share on, so the engine neither
// assumes manual nor penalises comps for a gearbox we don't know.
export const GEARBOX = { DOMINANT_SHARE: 0.8, MIN_ROWS: 5, YEAR_WINDOW: 1, WIDE_YEAR_WINDOW: 3 } as const;

export type Gearbox = "Automatic" | "Manual";
export interface GearboxGuess {
  /** Dominant gearbox when it holds >= DOMINANT_SHARE of matching adverts, else undefined (unknown). */
  gearbox?: Gearbox;
  /** Share of matching adverts that are automatic (incl. semi-auto, DSG, CVT); null when too few adverts. */
  autoShare: number | null;
  n: number;
}

/** Automatic-type gearbox text ("Automatic", "Semi-Auto", "DSG", "CVT", "Tiptronic"...). */
export const isAutoText = (g: unknown) => /auto|semi|dsg|cvt|tiptronic|steptronic|s ?tronic|pdk|dct|powershift|easytronic|edc/i.test(String(g ?? ""));
export const isManualText = (g: unknown) => /manual/i.test(String(g ?? ""));
/** True when the caller gave a usable gearbox. */
export const hasGearbox = (g: unknown) => isAutoText(g) || isManualText(g);

/** Pure: dominant gearbox from advert gearbox strings (blank / unknown rows ignored). */
export function gearboxFromListings(rows: { gearbox?: string | null }[], o: { share?: number; minRows?: number } = {}): GearboxGuess {
  let a = 0, m = 0;
  for (const r of rows) { if (isAutoText(r.gearbox)) a++; else if (isManualText(r.gearbox)) m++; }
  const n = a + m;
  if (n < (o.minRows ?? GEARBOX.MIN_ROWS)) return { autoShare: null, n };
  const autoShare = a / n, share = o.share ?? GEARBOX.DOMINANT_SHARE;
  const gearbox: Gearbox | undefined = autoShare >= share ? "Automatic" : 1 - autoShare >= share ? "Manual" : undefined;
  return { gearbox, autoShare: Math.round(autoShare * 1000) / 1000, n };
}

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any };
const likeEsc = (s: string) => s.replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim();

/** Gearbox guess from market_listings for make/model/year (year +-1, widening to +-3; full model name first, then its first word). */
export async function guessGearbox(admin: Admin | null, make?: string | null, model?: string | null, year?: number | null): Promise<GearboxGuess> {
  const mk = likeEsc(String(make ?? "")), md = likeEsc(String(model ?? "")), y = Number(year);
  if (!admin || !mk || !md || !Number.isFinite(y)) return { autoShare: null, n: 0 };
  const first = md.split(" ")[0];
  const models = first && first.length >= 2 && first.toLowerCase() !== md.toLowerCase() ? [md, first] : [md];
  let last: GearboxGuess = { autoShare: null, n: 0 };
  for (const m of models) for (const w of [GEARBOX.YEAR_WINDOW, GEARBOX.WIDE_YEAR_WINDOW]) {
    try {
      const { data, error } = await admin.from("market_listings").select("gearbox")
        .ilike("make", mk).ilike("model", `${m}%`).gte("year", y - w).lte("year", y + w).not("gearbox", "is", null).limit(600);
      if (error) return last;
      const g = gearboxFromListings((data ?? []) as { gearbox?: string | null }[]);
      if (g.autoShare != null) return g;
      last = g;
    } catch { return last; }
  }
  return last;
}
