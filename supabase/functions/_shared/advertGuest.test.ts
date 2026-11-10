import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { advertRequestFromValuation, cleanLocation } from "./advertRequest.ts";
import { guestOwns, reportEntitlement, sha256Hex } from "./entitlement.ts";

const row = {
  make: "Mazda", model: "3", year: 2019, mileage: 41234.6, registration: "AB19CDE", mot_expiry: "2027-03-01",
  report: { conditionScore: 8, conditionLabel: "Good", honestAnalysis: "Tidy car.", strengths: ["Full history", ""],
    recommendations: { listingPrice: 12950, recommendedAskingPrice: 13250, highlights: ["Low miles"] } },
};

Deno.test("advert request is built from the stored valuation, preferring the report asking price", () => {
  const a = advertRequestFromValuation(row, "  Leeds  ")!;
  assertEquals(a.price, 13250);
  assertEquals(a.mileage, 41235);
  assertEquals(a.location, "Leeds");
  assertEquals(a.strengths, ["Full history"]);
  assertEquals(a.highlights, ["Low miles"]);
});

Deno.test("advert request refuses a valuation with no price", () => {
  assertEquals(advertRequestFromValuation({ ...row, report: {} }), null);
});

Deno.test("guest location is short, single line and stripped of markup", () => {
  assertEquals(cleanLocation("<b>Leeds</b>\nWest Yorks"), "bLeedsb West Yorks");
  assertEquals(cleanLocation("x".repeat(200))!.length, 60);
  assertEquals(cleanLocation(42), undefined);
});

Deno.test("guest ownership needs no user and a matching token hash", async () => {
  const tok = "a".repeat(64);
  const h = await sha256Hex(tok);
  assert(await guestOwns({ user_id: null, guest_token_hash: h }, tok));
  assert(!(await guestOwns({ user_id: "u1", guest_token_hash: h }, tok)));
  assert(!(await guestOwns({ user_id: null, guest_token_hash: h }, "b".repeat(64))));
  assert(!(await guestOwns({ user_id: null, guest_token_hash: h }, "short")));
  assert(!(await guestOwns(null, tok)));
});

function fakeDb(purchases: unknown[], referrals: unknown[]) {
  return {
    from(t: string) {
      const rows = t === "report_purchases" ? purchases : referrals;
      const q: any = { select: () => q, eq: () => q, not: () => q, limit: () => Promise.resolve({ data: rows }) };
      return q;
    },
  } as any;
}

Deno.test("entitlement: purchase, referral, or nothing", async () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assertEquals(await reportEntitlement(fakeDb([{ id: 1 }], []), id), { paid: true, via: "purchase" });
  assertEquals(await reportEntitlement(fakeDb([], [{ code: "x" }]), id), { paid: true, via: "referral" });
  assertEquals(await reportEntitlement(fakeDb([], []), id), { paid: false });
  assertEquals(await reportEntitlement(fakeDb([{ id: 1 }], []), "not-a-uuid"), { paid: false });
});
