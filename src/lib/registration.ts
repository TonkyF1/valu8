/** Normalise a UK registration for lookup (strip every non-alphanumeric, upper-case). */
export function normaliseReg(input: string): string {
  return String(input ?? "").replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

/**
 * Loose UK plate validation: 2–7 alphanumerics with at least one letter and one
 * digit (covers current, prefix, suffix, dateless and NI formats). Strict enough
 * to reject typos like "HELLO" or "1234" before spending a lookup.
 */
export function isPlausibleUkReg(input: string): boolean {
  const r = normaliseReg(input);
  return /^[A-Z0-9]{2,7}$/.test(r) && /[A-Z]/.test(r) && /[0-9]/.test(r);
}

/** A lookup result is only "found" when it identifies the car. */
export function isFoundVehicle(l: { make?: string | null; model?: string | null } | null | undefined): boolean {
  return !!(l && (l.make ?? "").trim() && (l.model ?? "").trim());
}
