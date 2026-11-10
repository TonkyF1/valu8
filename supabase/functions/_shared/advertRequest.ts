// Valu8 — build the generate-advert input from a stored valuation (guest path), never from client-sent figures.
export interface AdvertRequest {
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  location?: string;
  price: number;
  conditionScore: number;
  conditionLabel: string;
  honestAnalysis: string;
  strengths: string[];
  highlights?: string[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const strList = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/** Location is the only free text a guest sends: short, single line, letters/digits/basic punctuation. */
export function cleanLocation(v: unknown): string | undefined {
  const s = str(v, 60).replace(/[^\p{L}\p{N} ,.'()-]/gu, "").trim();
  return s || undefined;
}

export function advertRequestFromValuation(row: any, location?: unknown): AdvertRequest | null {
  const r = row?.report ?? {};
  const rec = r.recommendations ?? {};
  const price = Number(rec.recommendedAskingPrice ?? rec.listingPrice);
  const year = Number(row?.year);
  if (!row?.make || !row?.model || !year || !(price > 0)) return null;
  return {
    make: str(row.make, 40),
    model: str(row.model, 60),
    year,
    mileage: Math.max(0, Math.round(Number(row.mileage) || 0)),
    registration: str(row.registration, 10) || undefined,
    motExpiry: str(row.mot_expiry, 30) || undefined,
    location: cleanLocation(location),
    price: Math.round(price),
    conditionScore: Number(r.conditionScore) || 0,
    conditionLabel: str(r.conditionLabel, 40) || "Not scored",
    honestAnalysis: str(r.honestAnalysis, 1200),
    strengths: strList(r.strengths, 8, 160),
    highlights: strList(rec.highlights, 8, 120),
  };
}
