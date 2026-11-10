// Valu8 — share-a-friend referral rules (pure, unit-tested). One share code per valuation; a friend's
// completed valuation unlocks the sharer's Full Report once. No accounts needed: ownership is the
// signed-in user id or the guest token hash already stored on the valuation.

export const SHARE_CODE_RE = /^[a-z0-9]{10}$/;
/** A friend's valuation must be finished within this long of the share code being created. */
export const SHARE_WINDOW_DAYS = 30;
/** And it must be fresh: made within this long of the redeem call (stops reusing old valuations). */
export const FRESH_HOURS = 3;

export function newShareCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l
  return Array.from(rand(10), (b) => alphabet[b % alphabet.length]).join("");
}

export type Owned = { id: string; user_id: string | null; guest_token_hash: string | null; registration: string | null; created_at: string };

const normReg = (r: string | null | undefined) => String(r ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function sameOwner(a: Owned, b: Owned): boolean {
  if (a.user_id && b.user_id && a.user_id === b.user_id) return true;
  if (a.guest_token_hash && b.guest_token_hash && a.guest_token_hash === b.guest_token_hash) return true;
  return false;
}

/** Why a friend's valuation can't redeem this share, or null when it can. */
export function redeemBlock(o: {
  share: { valuation_id: string; created_at: string; redeemed_at: string | null; ip_hash: string | null };
  sharer: Owned; friend: Owned; ipHash: string | null; now?: number;
}): string | null {
  const now = o.now ?? Date.now();
  if (o.share.redeemed_at) return "already_redeemed";
  if (o.friend.id === o.sharer.id) return "same_valuation";
  if (sameOwner(o.sharer, o.friend)) return "same_owner";
  const a = normReg(o.sharer.registration), b = normReg(o.friend.registration);
  if (a && b && a === b) return "same_car";
  const shareAt = Date.parse(o.share.created_at), friendAt = Date.parse(o.friend.created_at);
  if (!(friendAt > shareAt)) return "before_share";
  if (friendAt - shareAt > SHARE_WINDOW_DAYS * 86400_000) return "expired";
  if (now - friendAt > FRESH_HOURS * 3600_000) return "stale";
  if (o.share.ip_hash && o.ipHash && o.share.ip_hash === o.ipHash) return "same_network";
  return null;
}
