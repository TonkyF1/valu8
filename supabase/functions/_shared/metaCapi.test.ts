import { assertEquals, assert } from "jsr:@std/assert@1";
import { buildPurchaseEvent, metaCapiConfigured, sendMetaPurchase } from "./metaCapi.ts";

Deno.test("CAPI purchase hashes the email and never sends it raw", async () => {
  const body = await buildPurchaseEvent({ eventId: "cs_test_1", value: 2.99, currency: "gbp", email: " Someone@Example.com ", sourceUrl: "https://valu8.uk/valuation/x", time: 1 });
  const ev = body.data[0];
  assertEquals(ev.event_name, "Purchase");
  assertEquals(ev.event_id, "cs_test_1");
  assertEquals(ev.custom_data.currency, "GBP");
  const em = (ev.user_data as { em: string[] }).em[0];
  assertEquals(em.length, 64);
  assert(!JSON.stringify(body).includes("example.com"));
});

Deno.test("CAPI is switched off without both secrets and sends nothing", async () => {
  Deno.env.delete("META_PIXEL_ID"); Deno.env.delete("META_CAPI_TOKEN");
  assertEquals(metaCapiConfigured(), false);
  let called = false;
  const orig = globalThis.fetch;
  globalThis.fetch = (() => { called = true; return Promise.resolve(new Response("{}")); }) as typeof fetch;
  try { await sendMetaPurchase({ eventId: "x", value: 2.99, currency: "gbp", sourceUrl: "https://valu8.uk" }); } finally { globalThis.fetch = orig; }
  assertEquals(called, false);
});
