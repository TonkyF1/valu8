// Performance-trim inference from DVLA engine data.
// DVLA / DVSA only give make, a bare model ("Clio") and engine cc, so a Clio
// Renaultsport 200 (1618cc) used to be valued as a 1.6 Clio Expression.
// Within a model, some engine sizes were only ever fitted to the hot version;
// those rules are "confident" and pre-fill the trim. Others are shared with
// ordinary trims, so we only suggest the hot version and let the owner pick.
// Rules checked against 23.7k harvested UK listings with engine_cc.
// KEEP IN SYNC: src/lib/perfTrim.ts <-> supabase/functions/_shared/perfTrim.ts

export interface TrimHint {
  /** Variant to pre-fill (confident) or the first suggestion. */
  variant: string;
  /** Alternatives shown as quick-pick chips (includes `variant`). */
  options: string[];
  /** true = this engine size only came in the performance version(s). */
  confident: boolean;
  /** Short human reason, e.g. "1.6 petrol Clio (2013-2019) is the Renaultsport". */
  reason: string;
}

interface Rule {
  make: RegExp; model: RegExp; cc: [number, number]; years: [number, number];
  fuel?: "petrol" | "diesel"; manualOnly?: boolean;
  options: string[]; confident: boolean; name: string;
}

const P = "petrol" as const;
const R = (make: RegExp, model: RegExp, cc: [number, number], years: [number, number], options: string[], confident: boolean, name: string, extra: Partial<Rule> = {}): Rule =>
  ({ make, model, cc, years, fuel: P, options, confident, name, ...extra });

const RULES: Rule[] = [
  // Renault
  R(/renault/, /^clio/, [1615, 1620], [2013, 2019], ["Renaultsport", "Renaultsport Trophy"], true, "1.6 turbo petrol Clio"),
  R(/renault/, /^clio/, [1998, 1999], [1999, 2013], ["Renaultsport", "Renaultsport Cup"], true, "2.0 petrol Clio"),
  R(/renault/, /^megane/, [1795, 1800], [2018, 2030], ["Renaultsport", "Renaultsport Trophy"], true, "1.8 petrol Megane"),
  R(/renault/, /^megane/, [1998, 1999], [2004, 2016], ["Renaultsport", "Renaultsport Cup"], false, "2.0 petrol Megane"),
  // Ford
  R(/ford/, /^fiesta/, [1496, 1499], [2018, 2030], ["ST-2", "ST-3"], true, "1.5 EcoBoost petrol Fiesta"),
  R(/ford/, /^fiesta/, [1595, 1597], [2013, 2017], ["ST-2", "ST-3"], true, "1.6 EcoBoost petrol manual Fiesta", { manualOnly: true }),
  R(/ford/, /^fiesta/, [1998, 2000], [2005, 2008], ["ST"], true, "2.0 petrol Fiesta"),
  R(/ford/, /^focus/, [1998, 2000], [2012, 2018], ["ST-2", "ST-3"], true, "2.0 EcoBoost petrol Focus"),
  R(/ford/, /^focus/, [2259, 2262], [2016, 2018], ["RS"], true, "2.3 EcoBoost petrol Focus"),
  R(/ford/, /^focus/, [2259, 2300], [2019, 2030], ["ST"], true, "2.3 EcoBoost petrol Focus"),
  R(/ford/, /^focus/, [2500, 2522], [2005, 2011], ["ST-2", "ST-3", "RS"], true, "2.5 petrol Focus"),
  R(/ford/, /^puma/, [1495, 1498], [2020, 2030], ["ST"], true, "1.5 EcoBoost petrol Puma"),
  // VW group
  R(/volkswagen|^vw$/, /^golf/, [1984, 1984], [2009, 2030], ["GTI", "R", "GTI Clubsport"], true, "2.0 TSI petrol Golf"),
  R(/volkswagen|^vw$/, /^golf/, [3189, 3189], [2002, 2010], ["R32"], true, "3.2 V6 petrol Golf"),
  R(/volkswagen|^vw$/, /^golf/, [1781, 1781], [1983, 1992], ["GTI"], false, "1.8 petrol Golf"),
  R(/volkswagen|^vw$/, /^polo/, [1798, 1798], [2015, 2017], ["GTI"], true, "1.8 TSI petrol Polo"),
  R(/volkswagen|^vw$/, /^polo/, [1984, 1984], [2018, 2030], ["GTI"], true, "2.0 TSI petrol Polo"),
  R(/skoda/, /^octavia/, [1984, 1984], [2006, 2030], ["vRS"], false, "2.0 TSI petrol Octavia"),
  R(/seat|cupra/, /^leon/, [1984, 1984], [2006, 2030], ["Cupra", "FR"], false, "2.0 TSI petrol Leon"),
  // Others
  R(/honda/, /^civic/, [1996, 1998], [2001, 2011], ["Type R"], true, "2.0 petrol Civic"),
  R(/honda/, /^civic/, [1995, 1996], [2015, 2030], ["Type R"], true, "2.0 VTEC Turbo petrol Civic"),
  R(/hyundai/, /^i30/, [1998, 1998], [2017, 2030], ["N", "N Performance"], true, "2.0 T-GDi petrol i30"),
  R(/hyundai/, /^i20/, [1598, 1598], [2021, 2030], ["N"], true, "1.6 T-GDi petrol i20"),
  R(/hyundai/, /^kona/, [1998, 1998], [2021, 2030], ["N"], true, "2.0 T-GDi petrol Kona"),
  R(/toyota/, /^yaris/, [1618, 1618], [2020, 2030], ["GR"], true, "1.6 turbo petrol Yaris"),
  R(/vauxhall|opel/, /^corsa/, [1598, 1598], [2007, 2019], ["VXR", "SRi"], false, "1.6 turbo petrol Corsa"),
  R(/vauxhall|opel/, /^astra/, [1998, 1998], [2005, 2018], ["VXR", "SRi"], false, "2.0 turbo petrol Astra"),
  R(/mercedes/, /^a(?: ?class)?$/, [1991, 1991], [2013, 2030], ["AMG A 45", "AMG A 35", "A 250"], false, "2.0 petrol A-Class"),
  R(/peugeot/, /^208/, [1598, 1598], [2013, 2019], ["GTi", "Allure"], false, "1.6 THP petrol 208"),
  R(/mini/, /^(hatch|cooper|one|mini)/, [1998, 1998], [2014, 2030], ["Cooper S", "John Cooper Works"], false, "2.0 petrol MINI"),
];

const TRIM_IN_MODEL = /\b(?:rs|st|gti|gtd|r|r32|type r|n|gr|vxr|vrs|cupra|amg|jcw|john cooper works|renault ?sport|trophy|cup|clubsport|sri|fr|[a-z]?\d{2,3}[a-z]?)\b/;
const norm = (s?: string | null) => String(s ?? "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Suggests the performance trim implied by the engine. Returns null when the
 * model text already names a trim, or no rule applies.
 */
export function inferPerformanceTrim(v: {
  make?: string | null; model?: string | null; variant?: string | null;
  fuel?: string | null; cc?: number | null; year?: number | null; gearbox?: string | null;
}): TrimHint | null {
  const mk = norm(v.make), md = norm(v.model);
  const cc = Number(v.cc), year = Number(v.year);
  if (!mk || !md || !cc || !year || norm(v.variant)) return null;
  const fuel = norm(v.fuel);
  for (const r of RULES) {
    if (!r.make.test(mk) || !r.model.test(md)) continue;
    if (cc < r.cc[0] || cc > r.cc[1] || year < r.years[0] || year > r.years[1]) continue;
    if (r.fuel && fuel && !fuel.includes(r.fuel)) continue;
    if (r.fuel && !fuel) continue;
    if (r.manualOnly && /auto|cvt|dsg|semi/.test(norm(v.gearbox))) continue;
    // The DVLA model already carries a trim word (e.g. "Clio Renaultsport", "Golf R", "A45 AMG"): trust it.
    if (TRIM_IN_MODEL.test(md.split(" ").slice(1).join(" ").replace(/^class\b/, ""))) return null;
    return {
      variant: r.options[0], options: r.options, confident: r.confident,
      reason: `${r.name}${r.years[0] > 1990 ? ` (${r.years[0]}–${Math.min(r.years[1], new Date().getFullYear())})` : ""}`,
    };
  }
  return null;
}
