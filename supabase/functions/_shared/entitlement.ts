// Valu8 — is the £2.99 Full Report unlocked for a valuation? Paid purchase (report_purchases, written only by
// stripe-webhook) or a redeemed referral (referral_shares, written only by the referral function).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type Entitlement = { paid: false } | { paid: true; via: "purchase" | "referral" };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const GUEST_TOKEN_RE = /^[a-f0-9]{64}$/;

export async function reportEntitlement(db: SupabaseClient, valuationId: string): Promise<Entitlement> {
  if (!UUID_RE.test(valuationId)) return { paid: false };
  const [{ data }, { data: ref }] = await Promise.all([
    db.from("report_purchases").select("id").eq("valuation_id", valuationId).eq("status", "paid").limit(1),
    db.from("referral_shares").select("code").eq("valuation_id", valuationId).not("redeemed_at", "is", null).limit(1),
  ]);
  if (data && data.length) return { paid: true, via: "purchase" };
  if (ref && ref.length) return { paid: true, via: "referral" };
  return { paid: false };
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A guest owns a valuation when it has no user and its stored hash matches SHA-256(guest token). */
export async function guestOwns(row: { user_id?: string | null; guest_token_hash?: string | null } | null, guestToken: unknown): Promise<boolean> {
  if (!row || row.user_id || !row.guest_token_hash) return false;
  if (typeof guestToken !== "string" || !GUEST_TOKEN_RE.test(guestToken)) return false;
  return (await sha256Hex(guestToken)) === row.guest_token_hash;
}
