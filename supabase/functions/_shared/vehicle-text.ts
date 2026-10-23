// Pure helpers that turn raw DVSA / lookup strings into display-ready text.
// Shared by the lookup-vehicle edge function and the frontend report.

const FUEL_MAP: Record<string, string> = {
  "HEAVY OIL": "Diesel",
  "DIESEL": "Diesel",
  "PETROL": "Petrol",
  "ELECTRIC": "Electric",
  "ELECTRICITY": "Electric",
  "HYBRID ELECTRIC": "Hybrid",
  "HYBRID ELECTRIC (CLEAN)": "Hybrid",
  "PETROL/ELECTRIC": "Hybrid",
  "DIESEL/ELECTRIC": "Diesel hybrid",
  "GAS BI-FUEL": "Petrol/LPG",
  "GAS": "LPG",
};

function titleWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** DVSA reports diesel as "HEAVY OIL" and shouts everything in capitals. */
export function normaliseFuel(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const mapped = FUEL_MAP[s.toUpperCase()];
  if (mapped) return mapped;
  return s.split(/(\s+|\/|-)/).map((p) => (/^[A-Za-z]+$/.test(p) ? titleWord(p) : p)).join("");
}

/** "RED" -> "Red", "DARK BLUE" -> "Dark blue" */
export function normaliseColour(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return undefined;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Short all-caps tokens that are badges/acronyms, not words.
const KEEP_UPPER = new Set([
  "GR", "SD", "SE", "GT", "GTI", "GTD", "TDI", "TSI", "TFSI", "HEV", "PHEV", "CVT", "DCT", "TR", "ST", "RS", "AMG",
  "SRI", "SXI", "CDI", "CDTI", "DCI", "VTEC", "TDCI", "M", "R", "S", "XE", "XF", "XJ", "XC", "EV", "LE", "SR", "GL",
]);

function caseModelToken(tok: string): string {
  if (!tok) return tok;
  if (tok.includes("-")) return tok.split("-").map((p) => (p.length <= 2 && p === p.toUpperCase() ? p : caseModelToken(p))).join("-");
  // Lower-case-prefix model names: Hyundai i10/i20/i30/ix35, BMW i3/i4/iX.
  if (/^I[X]?\d{1,2}[A-Z]?$/i.test(tok) && !/^I\d{3}/i.test(tok)) return "i" + tok.slice(1).toLowerCase();
  if (/^IX$/i.test(tok)) return "iX";
  if (/\d/.test(tok)) return tok.replace(/^(\d{3})([DIE])$/, (_m, n: string, l: string) => n + l.toLowerCase());
  if (KEEP_UPPER.has(tok.toUpperCase())) return tok.toUpperCase();
  if (tok === tok.toUpperCase() && tok.length > 1) return titleWord(tok);
  return tok;
}

/**
 * Display name for a model. DVSA truncates BMW/numeric models ("320") — BMW's own
 * naming convention appends the fuel letter (320d diesel, 320i petrol, 330e plug-in),
 * so we restore it when the fuel is known. Also tidies DVSA all-caps.
 */
export function displayModel(make?: string | null, model?: string | null, fuel?: string | null): string {
  const raw = String(model ?? "").trim();
  if (!raw) return "";
  const [base, ...rest] = raw.split(" · ");
  const tokens = base.split(/\s+/).map(caseModelToken);
  const mk = String(make ?? "").trim().toUpperCase();
  const f = normaliseFuel(fuel ?? undefined);
  if ((mk === "BMW") && tokens.length >= 1 && /^\d{3}$/.test(tokens[0]) && f) {
    const suffix = /diesel/i.test(f) ? "d" : /^petrol$/i.test(f) ? "i" : /hybrid|plug/i.test(f) ? "e" : "";
    if (suffix) tokens[0] = tokens[0] + suffix;
  }
  return [tokens.join(" "), ...rest].join(" · ");
}

/** Vision models sometimes call the odometer a "rev counter" when reading mileage. */
export function fixOdometerWording(text: string): string {
  if (!text || !/\b(mi|mls|miles|mileage)\b/i.test(text)) return text;
  return text.replace(/\b(?:rev(?:olution)?[- ]counter|tachometer)\b/gi, (m) => (m[0] === m[0].toUpperCase() ? "Odometer" : "odometer"));
}

const MAKE_UPPER = new Set(["BMW", "MG", "DS", "BYD", "MINI", "KGM", "GWM", "TVR", "LEVC"]);

/** "AUDI" -> "Audi", "MERCEDES-BENZ" -> "Mercedes-Benz", "LAND ROVER" -> "Land Rover"; BMW/MG/MINI stay upper. */
export function displayMake(make?: string | null): string {
  const raw = String(make ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw.split(" ").map((w) => {
    if (MAKE_UPPER.has(w.toUpperCase())) return w.toUpperCase();
    if (w !== w.toUpperCase()) return w;
    return w.split("-").map((p) => titleWord(p)).join("-");
  }).join(" ");
}

/** "1248" cc -> "1.2"; ignores implausible values. */
export function engineLitres(cc?: number | string | null): string | undefined {
  const n = Number(cc);
  if (!Number.isFinite(n) || n < 500 || n > 8500) return undefined;
  return (Math.round(n / 100) / 10).toFixed(1);
}

/**
 * Report/vehicle title, e.g. "2014 Hyundai i20 1.2 Petrol". Adds trim (variant)
 * when the lookup supplied one, else engine size + fuel when known. Never invents.
 */
export function vehicleTitle(p: {
  year?: number | string | null; make?: string | null; model?: string | null;
  variant?: string | null; engineCapacity?: number | string | null; fuelType?: string | null;
}): string {
  const fuel = normaliseFuel(p.fuelType ?? undefined);
  const fullModel = String(p.model ?? "");
  const [baseModel, ...restParts] = fullModel.split(" · ");
  const variant = (p.variant ?? restParts.join(" · ")).trim();
  const model = displayModel(p.make, baseModel, fuel);
  const parts = [p.year ? String(p.year) : "", displayMake(p.make), model];
  const litres = engineLitres(p.engineCapacity);
  if (variant) parts.push(variant.split(/\s+/).map(caseModelToken).join(" "));
  else if (litres && !model.includes(litres)) parts.push(`${litres}${fuel && fuel !== "Electric" ? ` ${fuel}` : ""}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** UK-market names for common JDM-import model names (DVLA records the import name). */
const IMPORT_MODEL_ALIASES: Record<string, Record<string, string>> = {
  HONDA: { FIT: "Jazz", "FIT SHUTTLE": "Jazz", VEZEL: "HR-V", "GRACE": "Civic" },
  TOYOTA: { AQUA: "Prius C", VITZ: "Yaris", "ESTIMA": "Previa", "HARRIER": "RAV4" },
  NISSAN: { DAYZ: "Pixo", "X-TRAIL": "X-Trail" },
  MAZDA: { DEMIO: "2", AXELA: "3", ATENZA: "6" },
};

/**
 * Ordered, de-duplicated model names to try when searching listing APIs.
 * DVLA/VDG model strings often carry trim ("V70 R-Design SE D") or a bare
 * number ("6" for Mazda6), which return zero comps and drop the car to an
 * AI-only estimate. First candidate is always the original base model.
 */
export function compSearchModels(make?: string | null, model?: string | null): string[] {
  const mk = String(make ?? "").trim().toUpperCase();
  const base = String(model ?? "").split("·")[0].trim();
  if (!base) return [];
  const out: string[] = [base];
  const first = base.split(/\s+/)[0];
  const alias = IMPORT_MODEL_ALIASES[mk]?.[base.toUpperCase()] ?? IMPORT_MODEL_ALIASES[mk]?.[first.toUpperCase()];
  if (alias) out.push(alias);
  if (first && first !== base) out.push(first);
  // Mazda / similar: bare-number model names are listed as e.g. "Mazda6" / "MAZDA6".
  const num = (alias ?? first).match(/^\d$/);
  if (mk === "MAZDA" && num) out.push(`Mazda${num[0]}`, `MAZDA${num[0]}`);
  return [...new Set(out)];
}
