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
  /** true = every option is a performance version (e.g. A6 4.0 V8 = RS6 or S6), even when not confident which. */
  allPerf: boolean;
  /** Display model when the trim renames the car (e.g. "RS6" for an A6 4.0 V8). */
  modelName?: string;
}

interface Rule {
  make: RegExp; model: RegExp; cc: [number, number]; years: [number, number];
  fuel?: "petrol" | "diesel"; manualOnly?: boolean;
  options: string[]; confident: boolean; name: string; allPerf?: boolean;
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
  // Prestige performance models. DVLA often records an RS6 as "A6", an M3 as "3 Series", a C63 as "C Class".
  // Engine sizes below were only fitted to the performance versions (checked against harvested listings).
  R(/audi/, /^a3/, [2480, 2485], [2011, 2030], ["RS3"], true, "2.5 TFSI petrol A3"),
  R(/audi/, /^a3/, [1984, 1984], [2013, 2030], ["S3", "Sport / S line"], false, "2.0 TFSI petrol A3"),
  R(/audi/, /^a4/, [4163, 4163], [2003, 2016], ["RS4", "S4"], false, "4.2 V8 petrol A4", { allPerf: true }),
  R(/audi/, /^a4/, [2894, 2894], [2018, 2030], ["RS4"], true, "2.9 V6 biturbo petrol A4"),
  R(/audi/, /^a4/, [2995, 2995], [2009, 2030], ["S4"], true, "3.0 TFSI petrol A4"),
  R(/audi/, /^a5/, [4163, 4163], [2007, 2016], ["S5", "RS5"], false, "4.2 V8 petrol A5", { allPerf: true }),
  R(/audi/, /^a5/, [2894, 2894], [2017, 2030], ["RS5"], true, "2.9 V6 biturbo petrol A5"),
  R(/audi/, /^a5/, [2995, 2995], [2009, 2030], ["S5"], true, "3.0 TFSI petrol A5"),
  R(/audi/, /^a6/, [3993, 3996], [2012, 2018], ["RS6", "S6"], false, "4.0 V8 petrol A6", { allPerf: true }),
  R(/audi/, /^a6/, [3996, 3999], [2019, 2030], ["RS6"], true, "4.0 V8 petrol A6"),
  R(/audi/, /^a6/, [4991, 5204], [2006, 2011], ["RS6", "S6"], false, "V10 petrol A6", { allPerf: true }),
  R(/audi/, /^a7/, [3993, 3999], [2012, 2030], ["RS7", "S7"], false, "4.0 V8 petrol A7", { allPerf: true }),
  R(/audi/, /^tt/, [2480, 2485], [2009, 2030], ["TT RS"], true, "2.5 TFSI petrol TT"),
  R(/audi/, /^q5/, [2995, 2995], [2013, 2030], ["SQ5"], false, "3.0 TFSI petrol Q5", { allPerf: true }),
  R(/audi/, /^q8/, [3996, 3999], [2019, 2030], ["RS Q8", "SQ8"], false, "4.0 V8 petrol Q8", { allPerf: true }),
  R(/bmw/, /^(3|m3)/, [3246, 3246], [2000, 2006], ["M3"], true, "3.2 petrol 3 Series"),
  R(/bmw/, /^(3|m3)/, [3999, 3999], [2007, 2013], ["M3"], true, "4.0 V8 petrol 3 Series"),
  R(/bmw/, /^(3|m3)/, [2979, 2979], [2014, 2019], ["M3", "335i / 340i"], false, "3.0 twin-turbo petrol 3 Series"),
  R(/bmw/, /^(3|m3)/, [2993, 2993], [2021, 2030], ["M3"], true, "3.0 S58 petrol 3 Series"),
  R(/bmw/, /^(4|m4)/, [2979, 2979], [2014, 2020], ["M4", "435i / 440i"], false, "3.0 twin-turbo petrol 4 Series"),
  R(/bmw/, /^(4|m4)/, [2993, 2993], [2021, 2030], ["M4"], true, "3.0 S58 petrol 4 Series"),
  R(/bmw/, /^(2|m2)/, [2979, 2979], [2016, 2021], ["M2", "M235i / M240i"], false, "3.0 petrol 2 Series", { allPerf: true }),
  R(/bmw/, /^(2|m2)/, [2993, 2993], [2023, 2030], ["M2"], true, "3.0 S58 petrol 2 Series"),
  R(/bmw/, /^(5|m5)/, [4999, 4999], [2005, 2010], ["M5"], true, "5.0 V10 petrol 5 Series"),
  R(/bmw/, /^(5|m5)/, [4395, 4395], [2011, 2030], ["M5", "550i / M550i"], false, "4.4 V8 petrol 5 Series", { allPerf: true }),
  R(/bmw/, /^(6|m6)/, [4395, 4999], [2005, 2019], ["M6", "650i"], false, "V8/V10 petrol 6 Series", { allPerf: true }),
  R(/mercedes/, /^c(?: ?class)?$/, [6208, 6208], [2007, 2014], ["C63 AMG"], true, "6.2 V8 petrol C-Class"),
  R(/mercedes/, /^c(?: ?class)?$/, [3982, 3982], [2015, 2030], ["C63 AMG"], true, "4.0 V8 petrol C-Class"),
  R(/mercedes/, /^c(?: ?class)?$/, [2996, 2996], [2016, 2030], ["C43 AMG", "C400"], false, "3.0 V6 petrol C-Class", { allPerf: true }),
  R(/mercedes/, /^e(?: ?class)?$/, [5461, 6208], [2007, 2016], ["E63 AMG"], true, "V8 petrol E-Class"),
  R(/mercedes/, /^e(?: ?class)?$/, [3982, 3982], [2017, 2030], ["E63 AMG"], true, "4.0 V8 petrol E-Class"),
  R(/mercedes/, /^cla/, [1991, 1991], [2013, 2030], ["CLA 45 AMG", "CLA 35 AMG", "CLA 250"], false, "2.0 petrol CLA"),
  R(/mercedes/, /^s(?: ?class)?$/, [5461, 5461], [2013, 2018], ["S63 AMG"], true, "5.5 V8 petrol S-Class"),
  R(/mercedes/, /^g(?: ?class)?$/, [3982, 5461], [2012, 2030], ["G63 AMG", "G500"], false, "V8 petrol G-Class", { allPerf: true }),
  R(/vauxhall|opel/, /^insignia/, [2792, 2792], [2009, 2017], ["VXR"], true, "2.8 V6 petrol Insignia"),
  R(/nissan/, /^juke/, [1618, 1618], [2013, 2019], ["Nismo", "Tekna DIG-T"], false, "1.6 DIG-T petrol Juke"),
  R(/subaru/, /^impreza/, [2457, 2457], [2006, 2015], ["STI", "WRX"], false, "2.5 turbo petrol Impreza", { allPerf: true }),
  R(/mitsubishi/, /^lancer/, [1997, 1998], [2003, 2016], ["Evolution", "Ralliart"], false, "2.0 turbo petrol Lancer", { allPerf: true }),
  R(/alfa/, /^(giulia|stelvio)/, [2891, 2891], [2016, 2030], ["Quadrifoglio"], true, "2.9 V6 petrol Giulia/Stelvio"),
  R(/jaguar/, /^f[- ]?pace/, [4999, 5000], [2016, 2030], ["SVR"], true, "5.0 V8 petrol F-Pace"),
  R(/land rover/, /^range rover sport/, [4999, 5000], [2013, 2030], ["SVR", "Autobiography Dynamic"], false, "5.0 V8 petrol Range Rover Sport"),
  R(/peugeot/, /^308/, [1598, 1598], [2015, 2021], ["GTi", "GT"], false, "1.6 THP petrol 308"),
];

const TRIM_IN_MODEL = /\b(?:rs ?q?\d|s\d|m\d|[cegs] ?(?:43|45|63)|rs|st|gti|gtd|r|r32|type r|n|gr|vxr|vrs|cupra|amg|jcw|john cooper works|renault ?sport|trophy|cup|clubsport|sri|fr|[a-z]?\d{2,3}[a-z]?)\b/;
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
      variant: r.options[0], options: r.options, confident: r.confident, allPerf: r.confident || !!r.allPerf,
      reason: `${r.name}${r.years[0] > 1990 ? ` (${r.years[0]}–${Math.min(r.years[1], new Date().getFullYear())})` : ""}`,
    };
  }
  return null;
}
