// Valu8 guest mode: anyone can get a full valuation without an account.
//
// - A random guest token lives in localStorage. analyse-vehicle stores only a
//   SHA-256 hash of it next to the guest's valuation (user_id is null), and
//   saves the row itself with the service role, so RLS never opens to anon.
// - The guest's own report is read back through the get-shared-valuation edge
//   function using the unguessable valuation UUID (same model as share links).
// - When the guest later signs in or signs up, claim-guest-valuations moves
//   every valuation made with this token into their account.
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "valu8_guest_token";
const IDS_KEY = "valu8_guest_valuations";
const DISMISS_KEY = "valu8_guest_save_dismissed";
export const RETURN_KEY = "valu8_return_to";

/** Server-side daily cap for guests (mirrors GUEST_DAILY_CAP in analyse-vehicle). */
export const GUEST_DAILY_CAP = 3;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getGuestToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
    const t = randomToken();
    localStorage.setItem(TOKEN_KEY, t);
    return t;
  } catch {
    // Storage blocked (private mode): still allow a one-off guest valuation.
    return randomToken();
  }
}

export function peekGuestToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getGuestValuationIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(IDS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

export function rememberGuestValuation(id: string) {
  try {
    const ids = getGuestValuationIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(IDS_KEY, JSON.stringify(ids.slice(0, 50)));
  } catch { /* storage unavailable */ }
}

export function isGuestValuation(id: string | undefined | null): boolean {
  return !!id && getGuestValuationIds().includes(id);
}

export function guestSaveDismissed(id: string): boolean {
  try { return sessionStorage.getItem(`${DISMISS_KEY}:${id}`) === "1"; } catch { return false; }
}
export function dismissGuestSave(id: string) {
  try { sessionStorage.setItem(`${DISMISS_KEY}:${id}`, "1"); } catch { /* ignore */ }
}

/** Remember where to send the user after they sign in / sign up. */
export function setReturnTo(path: string) {
  try { sessionStorage.setItem(RETURN_KEY, path); } catch { /* ignore */ }
}
export function getReturnTo(): string | null {
  try {
    const p = sessionStorage.getItem(RETURN_KEY);
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  } catch { return null; }
}
export function clearReturnTo() {
  try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
}

let claimPromise: Promise<number> | null = null;
let claimedFor: string | null = null;

/**
 * Move this browser's guest valuations into the signed-in account.
 * Safe to call repeatedly; runs at most once per user per page load.
 * Returns how many valuations were claimed (0 if none / backend not ready).
 */
export function claimGuestValuations(userId: string): Promise<number> {
  const token = peekGuestToken();
  if (!token || getGuestValuationIds().length === 0) return Promise.resolve(0);
  if (claimPromise && claimedFor === userId) return claimPromise;
  claimedFor = userId;
  claimPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("claim-guest-valuations", { body: { guestToken: token } });
      if (error || (data as any)?.error) return 0;
      const n = Number((data as any)?.claimed ?? 0);
      // Claimed rows now belong to the account; start a fresh guest identity.
      try { localStorage.removeItem(IDS_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  })();
  return claimPromise;
}

/** Downscale a photo to a JPEG data URL so a guest upload stays small (~150-300 KB). */
export async function photoToDataUrl(file: File, maxEdge = 1280, quality = 0.82): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

/** Read the JSON error body from a supabase.functions.invoke error, if any. */
export async function functionErrorBody(err: unknown): Promise<{ status?: number; body: any }> {
  const ctx = (err as any)?.context;
  const status = typeof ctx?.status === "number" ? ctx.status : undefined;
  try {
    const body = await ctx?.clone?.().json?.() ?? await ctx?.json?.();
    return { status, body };
  } catch {
    return { status, body: null };
  }
}
