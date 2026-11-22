import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { guestCaps, turnstileRequired } from "./guestCap.ts";

Deno.test("guestCap: per-token 3, shared-IP ceiling 15 (60 with Turnstile), guests-only Turnstile", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  assertEquals(guestCaps(env({})).token, 3);
  assertEquals(guestCaps(env({})).ip, 15);
  assertEquals(guestCaps(env({ TURNSTILE_SECRET_KEY: "x" })).ip, 60);
  assertEquals(turnstileRequired(env({ TURNSTILE_SECRET_KEY: "x" }), true), false);
  assertEquals(turnstileRequired(env({ TURNSTILE_SECRET_KEY: "x" }), false), true);
});
