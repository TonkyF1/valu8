// Import detection (rare-cars-1, after SK51EYX: a JDM Honda Integra built in 2001, first registered in the UK in 2005
// on a "51" plate, was valued as a 2005 car).
// DVSA gives the first UK registration date and, for most cars, a manufactureDate. A car is a likely import only when
// it was built 2+ years before its first UK registration, or when the model was never sold new in the UK.
// The plate's letters/numbers are NEVER used to infer age: cherished/transferred plates (T80GOU on a 2016 Corsa,
// GB51DLB on a 2012 Smart) don't match the registration date and are not a sign of an import. Only a Q plate (age
// unknown) gives a "possible" flag. Pure TS, no imports: shared by lookup-vehicle, analyse-vehicle and tests.

const PREFIX_YEAR: Record<string, number> = {
  A: 1983, B: 1984, C: 1985, D: 1986, E: 1987, F: 1988, G: 1989, H: 1990, J: 1991, K: 1992, L: 1993, M: 1994,
  N: 1995, P: 1996, R: 1997, S: 1998, T: 1999, V: 1999, W: 2000, X: 2000, Y: 2001,
};
const SUFFIX_YEAR: Record<string, number> = {
  A: 1963, B: 1964, C: 1965, D: 1966, E: 1967, F: 1968, G: 1969, H: 1970, J: 1971, K: 1972, L: 1973, M: 1974,
  N: 1975, P: 1976, R: 1977, S: 1978, T: 1979, V: 1980, W: 1981, X: 1982, Y: 1983,
};

const cleanReg = (r?: string | null) => String(r ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Year implied by the plate's age identifier, "Q" for Q plates, or null (dateless / cherished / unknown).
 * Informational only: assessImport never uses the year (a plate can be transferred onto any later car). */
export function plateAgeYear(reg?: string | null, now: Date = new Date()): number | "Q" | null {
  const r = cleanReg(reg);
  if (/^Q\d{1,3}[A-Z]{3}$/.test(r) || /^[A-Z]{3}\d{1,3}Q$/.test(r)) return "Q";
  let m = r.match(/^[A-Z]{2}(\d{2})[A-Z]{3}$/);
  if (m) {
    const n = Number(m[1]);
    const y = n >= 51 ? 2000 + n - 50 : 2000 + n;
    return n === 0 || n === 50 || y > now.getFullYear() ? null : y;
  }
  m = r.match(/^([A-Z])\d{1,3}[A-Z]{3}$/);
  if (m) return PREFIX_YEAR[m[1]] ?? null;
  m = r.match(/^[A-Z]{3}\d{1,3}([A-Z])$/);
  if (m) return SUFFIX_YEAR[m[1]] ?? null;
  return null;
}

// Models never (or no longer) sold new in the UK: a UK registration after `ukUntil` means a personal/grey import.
const JDM: { make: RegExp; model: RegExp; ukUntil: number }[] = [
  { make: /honda/, model: /^integra/, ukUntil: 2001 },
  { make: /honda/, model: /^(beat|stepw(a)?gon|vamos|life|n ?box|n-?one|elysion|freed|zest|that'?s|mobilio|airwave|edix)/, ukUntil: 0 },
  { make: /honda/, model: /^(s660|torneo|inspire|legend coupe|odyssey absolute)/, ukUntil: 0 },
  { make: /nissan/, model: /^(skyline|silvia|180sx|stagea|cima|cedric|gloria|laurel|cefiro|elgrand|serena highway|fairlady|march|cube|figaro|be-?1|pao|s-?cargo|leopard|gloria|presage|wingroad)/, ukUntil: 0 },
  { make: /toyota/, model: /^(chaser|soarer|aristo|mark ?(ii|x|2)|crown|alphard|vellfire|estima|century|altezza|cresta|sera|noah|voxy|hiace regius|granvia|sprinter trueno|levin|vitz|harrier|bb|sienta|porte|aqua)/, ukUntil: 0 },
  { make: /toyota/, model: /^supra/, ukUntil: 2002 },
  { make: /mazda/, model: /^(eunos|bongo|autozam|az-?1|efini|cosmo|roadster)/, ukUntil: 0 },
  { make: /mitsubishi/, model: /^(delica|pajero (io|mini)|gto|fto|legnum|galant vr-?4|ek)/, ukUntil: 0 },
  { make: /subaru/, model: /^(sambar|pleo|stella|r2|legacy b4|exiga|levorg sti)/, ukUntil: 0 },
  { make: /suzuki/, model: /^(cappuccino|every|hustler|wagon r\+? ?(rr|stingray)|alto works|jimny sierra)/, ukUntil: 0 },
  { make: /daihatsu/, model: /^(move|tanto|mira|hijet|atrai)/, ukUntil: 0 },
];

/** True when this model + first-UK-registration year can only be an import. */
export function isJdmImportModel(make?: string | null, model?: string | null, firstRegYear?: number | null): boolean {
  const mk = String(make ?? "").toLowerCase().trim(), md = String(model ?? "").toLowerCase().trim();
  if (!mk || !md) return false;
  return JDM.some((j) => j.make.test(mk) && j.model.test(md) && (!firstRegYear || !j.ukUntil || firstRegYear > j.ukUntil));
}

export interface ImportAssessment {
  status: "likely" | "possible" | "no";
  /** Year the car was built (DVSA manufactureDate), when it differs from the first UK registration year. */
  buildYear?: number;
  firstRegYear?: number;
  reason?: string;
}

const yearOf = (d?: string | number | null) => { const y = Number(String(d ?? "").slice(0, 4)); return y > 1900 && y < 2100 ? y : undefined; };

export function assessImport(v: {
  registration?: string | null; firstRegistered?: string | null; manufactureDate?: string | number | null;
  make?: string | null; model?: string | null; now?: Date;
}): ImportAssessment {
  const fY = yearOf(v.firstRegistered);
  const mY = yearOf(v.manufactureDate);
  if (mY && fY && fY - mY >= 2) {
    return { status: "likely", buildYear: mY, firstRegYear: fY, reason: `built in ${mY} but first registered in the UK in ${fY}` };
  }
  if (isJdmImportModel(v.make, v.model, fY)) {
    return { status: "likely", firstRegYear: fY, reason: "this model wasn't sold new in the UK at the time" };
  }
  if (plateAgeYear(v.registration, v.now) === "Q") {
    return { status: "possible", firstRegYear: fY, reason: "it carries a Q plate, so its age couldn't be confirmed" };
  }
  return { status: "no", firstRegYear: fY };
}

/** Short report note for an import (no price claims). */
export function importNote(a: ImportAssessment): string | null {
  if (a.status === "no") return null;
  const lead = a.status === "likely" ? "This looks like an imported car" : "This may be an imported car";
  return `${lead}${a.reason ? ` (${a.reason})` : ""}. Imports can sell for more or less than UK-supplied cars depending on spec, history and paperwork, so we've widened the range.`;
}
