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
