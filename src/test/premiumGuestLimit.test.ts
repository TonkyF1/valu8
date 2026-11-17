// Premium path past the free guest cap: the paid report is never blocked, the free path still is,
// and a price-locked valuation shows no figures until it is paid for.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const token = "a".repeat(64);
const request = (body: unknown) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });
const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

function load(name: string, overrides: Record<string, unknown> = {}, shared = true) {
  let handler: (req: Request) => Promise<Response> = async () => json({}, 500);
  const source = read(`supabase/functions/${name}/index.ts`)
    .replace(/^import[\s\S]*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  const mocks: Record<string, unknown> = {
    Deno: { env: { get: () => undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    ...(shared ? {
      corsHeaders: {}, json, guard: async () => ({ userId: null }),
      checkLimit: async () => true, clientIp: () => "test-ip", envInt: (_: string, fallback: number) => fallback,
      adminClient: () => null,
    } : {}),
    ...overrides,
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function(...Object.keys(mocks), code)(...Object.values(mocks));
  return (req: Request) => handler(req);
}

const hashOf = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");

describe("analyse-vehicle guest cap and the premium path", () => {
  it("free path past the cap is still blocked, with no em dash in the message", async () => {
    const handler = load("analyse-vehicle", { checkLimit: async () => false });
    const res = await handler(request({ guestToken: token }));
    expect(res.status).toBe(429);
    const b = await res.json();
    expect(b.code).toBe("guest_limit");
    expect(b.error).not.toMatch(/[\u2014\u2013]/);
  });

  it("premium path past the free cap is let through (on its own cap) instead of 429", async () => {
    const calls: unknown[][] = [];
    const handler = load("analyse-vehicle", {
      checkLimit: async (...args: unknown[]) => { calls.push(args); return String(args[0]).includes(":p:"); },
    });
    const res = await handler(request({ guestToken: token, premiumIntent: true }));
    // Gets past the cap to vehicle validation (no make/model in this request).
    expect(res.status).toBe(400);
    const h = await hashOf(token);
    expect(calls).toEqual([
      ["analyse:guest:ip:test-ip:d", 86400, 3], [`analyse:guest:t:${h}:d`, 86400, 3],
      ["analyse:guest:p:ip:test-ip:d", 86400, 16], [`analyse:guest:p:t:${h}:d`, 86400, 8],
    ]);
  });

  it("premium path has its own daily cap so it can't be farmed", async () => {
    const handler = load("analyse-vehicle", { checkLimit: async () => false });
    const res = await handler(request({ guestToken: token, premiumIntent: true }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("guest_limit");
  });

  it("premiumIntent must be exactly true", async () => {
    const handler = load("analyse-vehicle", { checkLimit: async () => false });
    for (const premiumIntent of ["true", 1, "yes"]) expect((await handler(request({ guestToken: token, premiumIntent }))).status).toBe(429);
  });

  it("a locked valuation is saved with priceLocked and returned without figures", () => {
    const src = read("supabase/functions/analyse-vehicle/index.ts");
    expect(src).toMatch(/\.\.\.\(priceLocked \? \{ priceLocked: true \} : \{\}\)/);
    expect(src).toContain("if (priceLocked) return json({ valuationId: guestValuationId, locked: true, priceable: !report.valuationUnavailable });");
    // Refining a locked row keeps it locked.
    expect(src).toContain("priceLocked = (row as any)?.report?.priceLocked === true;");
  });

  it("engine and guard settings are untouched", () => {
    const src = read("supabase/functions/analyse-vehicle/index.ts");
    expect(src).toContain("v2.2-ledger");
    expect(src).toContain('const cap = envInt("GUEST_DAILY_CAP", 3);');
  });
});

describe("lookup-vehicle guest cap", () => {
  it("free lookups past the cap are blocked", async () => {
    const handler = load("lookup-vehicle", { checkLimit: async () => false });
    expect((await handler(request({ registration: "SE15WEV" }))).status).toBe(429);
  });
  it("premium lookups get their own allowance", async () => {
    const calls: unknown[][] = [];
    const handler = load("lookup-vehicle", { checkLimit: async (...a: unknown[]) => { calls.push(a); return String(a[0]).includes(":p:"); } });
    const res = await handler(request({ registration: "!!", premiumIntent: true }));
    expect(res.status).toBe(400); // past the cap, into reg validation
    expect(calls).toEqual([["lookup:guest:ip:test-ip:d", 86400, 10], ["lookup:guest:p:ip:test-ip:d", 86400, 10]]);
  });
});

describe("get-shared-valuation hides a locked price until paid", () => {
  const row = { id: "11111111-1111-4111-8111-111111111111", make: "VOLKSWAGEN", model: "POLO", year: 2015, mileage: 89094, registration: "SE15WEV", mot_expiry: null, photo_urls: [], created_at: "", user_id: null, guest_token_hash: null,
    report: { priceLocked: true, values: { privateSale: 4200 }, headline: "Worth about £4,200", valuationUnavailable: false } };
  const db = () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }), storage: { from: () => ({}) } });
  const fn = (paid: boolean) => load("get-shared-valuation", {
    createClient: db, reportEntitlement: async () => (paid ? { paid: true, via: "purchase" } : { paid: false }),
  }, false);
  it("unpaid: no figures at all", async () => {
    const b = await (await fn(false)(request({ id: row.id }))).json();
    expect(b.report).toEqual({ priceLocked: true, valuationUnavailable: false, vehicle: null });
    expect(JSON.stringify(b)).not.toContain("4200");
  });
  it("paid: the full report", async () => {
    const b = await (await fn(true)(request({ id: row.id }))).json();
    expect(b.report.values.privateSale).toBe(4200);
  });
});

describe("home flow premium path (TeslaFlow)", () => {
  const flow = read("src/components/tesla/TeslaFlow.tsx");
  it("sends premiumIntent on the premium path and handles a locked result", () => {
    expect(flow).toContain("...(extra.premiumIntent ? { premiumIntent: true } : {}),");
    expect(flow).toContain("premiumIntent: premium }, null);");
    expect(flow).toContain("refineOf: valuationId, premiumIntent: premium }, valuationId);");
    expect(flow).toMatch(/if \(res\.locked\) \{[\s\S]{0,700}setCheckoutOpen\(true\)/);
  });
  it("free limit switches the details step to the single Pay button with a soft note", () => {
    expect(flow).toContain("if (!extra.premiumIntent) setPremiumBusy(true);");
    expect(flow).toContain('<GuestLimit message={guestLimit} premium={premiumBusy && limitKind === "free"} />');
    expect(flow).toContain("Today's free valuations are used up");
  });
  it("never fails silently: unpriceable, valuation and checkout failures all show a message with a retry", () => {
    expect(flow).toContain('data-testid="pay-error"');
    expect(flow).toContain("Try again");
    expect(flow).toMatch(/catch \(e2: any\) \{[\s\S]{0,200}setPayErr\(m\)/);
    const co = read("src/components/ReportCheckout.tsx");
    expect(co).toContain('data-testid="checkout-error"');
    expect(co).toContain("<CheckoutElementsProvider key={attempt}");
    expect(co).not.toContain("checkoutState.error.message");
    // One Stripe session per open: an inline onPaid from the parent must not re-create it on re-render.
    expect(co).toContain("}, [valuationId, attempt]);");
    expect(co).toContain("onPaidRef.current?.()");
  });
  it("loader fades out before unmounting", () => {
    expect(flow).toContain("out={loaderOut}");
    expect(read("src/styles/tesla.css")).toContain(".t8-loader.out{");
  });
  it("homepage Unlock buttons open checkout, glide to Pay, or arm the reg card", () => {
    expect(flow).toMatch(/premium && f\.stage === "refined" && f\.valuationId && f\.canPay[\s\S]{0,200}setCheckoutOpen\(true\)/);
    expect(flow).toMatch(/payRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
    expect(flow).toContain("if (premium && !f.hasCar) setPremiumArmed(true);");
    expect(flow).toContain("void start(undefined, premiumArmed);");
    expect(flow).toContain("Premium Report selected. Enter the reg to continue.");
  });
  it("copy rules hold", () => {
    for (const f of [flow, read("src/pages/Report.tsx"), read("src/components/ReportCheckout.tsx")]) {
      expect(f).not.toMatch(/gumtree/i);
    }
    expect(flow).not.toContain("\u2014");
  });
});

describe("report page for a locked guest report", () => {
  const rep = read("src/pages/Report.tsx");
  it("shows the unlock view until paid, then re-reads the full report", () => {
    expect(rep).toContain('data-testid="locked-report"');
    expect(rep).toContain("if (priceLocked && (!reportPaid || lockedEmpty))");
    expect(rep).toContain("if (reportPaid && lockedEmpty) setReloadKey((k) => k + 1);");
  });
});
