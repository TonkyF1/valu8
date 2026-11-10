import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { newShareCode, redeemBlock, sameOwner, SHARE_CODE_RE, type Owned } from "./referral.ts";
import { buildFollowupEmail, buildReportEmail, reportOfferUrl } from "./emailTemplates.ts";

const T0 = Date.parse("2026-11-10T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const sharer: Owned = { id: "s", user_id: null, guest_token_hash: "aaa", registration: "AB12 CDE", created_at: iso(T0 - 3600_000) };
const friend: Owned = { id: "f", user_id: null, guest_token_hash: "bbb", registration: "XY65ZZZ", created_at: iso(T0 + 600_000) };
const share = { valuation_id: "s", created_at: iso(T0), redeemed_at: null, ip_hash: "ip1" };
const ok = (over: Partial<Parameters<typeof redeemBlock>[0]> = {}) => redeemBlock({ share, sharer, friend, ipHash: "ip2", now: T0 + 1200_000, ...over });

Deno.test("referral: share codes are 10 safe characters", () => {
  for (let i = 0; i < 50; i++) assertMatch(newShareCode(), SHARE_CODE_RE);
  assert(!/[01lo]/.test(newShareCode(() => new Uint8Array(10).fill(255))));
});

Deno.test("referral: a different person valuing a different car redeems", () => {
  assertEquals(ok(), null);
});

Deno.test("referral: blocks self-referral and reuse", () => {
  assertEquals(ok({ share: { ...share, redeemed_at: iso(T0) } }), "already_redeemed");
  assertEquals(ok({ friend: { ...friend, id: "s" } }), "same_valuation");
  assertEquals(ok({ friend: { ...friend, guest_token_hash: "aaa" } }), "same_owner");
  assertEquals(ok({ sharer: { ...sharer, user_id: "u1" }, friend: { ...friend, user_id: "u1" } }), "same_owner");
  assertEquals(ok({ friend: { ...friend, registration: "ab12cde" } }), "same_car");
  assertEquals(ok({ ipHash: "ip1" }), "same_network");
});

Deno.test("referral: timing rules", () => {
  assertEquals(ok({ friend: { ...friend, created_at: iso(T0 - 1000) } }), "before_share");
  assertEquals(ok({ friend: { ...friend, created_at: iso(T0 + 31 * 86400_000) }, now: T0 + 31 * 86400_000 + 1000 }), "expired");
  assertEquals(ok({ now: T0 + 5 * 3600_000 }), "stale");
});

Deno.test("referral: owners compare by user id or guest hash only", () => {
  assert(!sameOwner({ ...sharer, guest_token_hash: null }, { ...friend, guest_token_hash: null }));
});

Deno.test("emails: valuation emails carry the £2.99 report link tagged utm_source=email", async () => {
  if (!Deno.env.get("EMAIL_UNSUB_SECRET")) Deno.env.set("EMAIL_UNSUB_SECRET", "test-only-secret");
  const url = reportOfferUrl("abc", "report_ready");
  assert(url.includes("utm_source=email") && url.includes("#report-checkout"));
  const m = buildReportEmail("valuation", { id: "abc", make: "Ford", model: "Fiesta", report: { values: { privateSale: 9000, dealerTradeIn: 7000, dealerRetail: 11000 } } }, "https://u");
  assert(m.html.includes("utm_source=email") && m.html.includes("£2.99"));
  const f = await buildFollowupEmail("valuation", { id: "abc", make: "Ford", model: "Fiesta", report: {} }, "https://u");
  assert(f.html.includes("utm_campaign=followup") && f.text!.includes("£2.99"));
});
