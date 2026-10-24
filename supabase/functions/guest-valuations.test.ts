import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const transpiler = new Bun.Transpiler({ loader: "ts" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const token = "a".repeat(64);
const request = (body: unknown) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });

function load(name: string, overrides: Record<string, unknown> = {}) {
  let handler: (req: Request) => Promise<Response> = async () => json({}, 500);
  const source = readFileSync(new URL(`./${name}/index.ts`, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\s*$/gm, "")
    .replace(/^export\s+/gm, "");
  const mocks = {
    Deno: { env: { get: () => undefined }, serve: (fn: typeof handler) => { handler = fn; } },
    corsHeaders: {}, json, guard: async () => ({ userId: null }),
    checkLimit: async () => true, clientIp: () => "test-ip", envInt: (_: string, fallback: number) => fallback,
    adminClient: () => null, ...overrides,
  };
  new Function(...Object.keys(mocks), transpiler.transformSync(source))(...Object.values(mocks));
  return (req: Request) => handler(req);
}

test("guest analysis requires exactly 64 lowercase hexadecimal characters", async () => {
  const handler = load("analyse-vehicle");
  for (const guestToken of [undefined, "a".repeat(63), "a".repeat(65), "A".repeat(64), "z".repeat(64)]) {
    expect((await handler(request({ guestToken }))).status).toBe(400);
  }
  expect((await handler(request({ guestToken: token }))).status).toBe(400); // vehicle validation, not token rejection
});

test("guest analysis checks IP and hashed token at 3 per 86400 seconds", async () => {
  const calls: unknown[][] = [];
  const handler = load("analyse-vehicle", { checkLimit: async (...args: unknown[]) => { calls.push(args); return false; } });
  const response = await handler(request({ guestToken: token }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  expect(calls).toEqual([["analyse:guest:ip:test-ip:d", 86400, 3], [`analyse:guest:t:${hash}:d`, 86400, 3]]);
  expect(response.status).toBe(429);
  expect((await response.json()).code).toBe("guest_limit");
});

for (const [name, key] of [["lookup-vehicle", "lookup"], ["fair-price", "fair-price"]]) {
  test(`${name} limits guests to 10 per day`, async () => {
    const calls: unknown[][] = [];
    const handler = load(name, { checkLimit: async (...args: unknown[]) => { calls.push(args); return false; } });
    const response = await handler(request({}));
    expect(calls).toEqual([[`${key}:guest:ip:test-ip:d`, 86400, 10]]);
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("guest_limit");
  });
  test(`${name} does not apply guest limits to signed-in callers`, async () => {
    let guestChecks = 0;
    const handler = load(name, { guard: async () => ({ userId: "owner" }), checkLimit: async () => { guestChecks++; return false; } });
    expect((await handler(request({}))).status).toBe(400);
    expect(guestChecks).toBe(0);
  });
}

test("claim requires sign-in and valid token", async () => {
  expect((await load("claim-guest-valuations")(request({ guestToken: token }))).status).toBe(401);
  const signedIn = load("claim-guest-valuations", { guard: async () => ({ userId: "owner" }) });
  expect((await signedIn(request({ guestToken: "invalid" }))).status).toBe(400);
});

test("claim limits to 50 unclaimed rows, moves only report-owned photos and clears hash", async () => {
  const calls: unknown[][] = [];
  const moves: string[][] = [];
  let update: Record<string, unknown> = {};
  const query: Record<string, (...args: any[]) => any> = {};
  for (const name of ["select", "eq", "is"]) query[name] = (...args: unknown[]) => { calls.push([name, ...args]); return query; };
  query.limit = async (n: number) => { calls.push(["limit", n]); return { data: [{ id: "row", photo_urls: ["guest/row/0.jpg", "guest/row/1.jpg", "guest/other/2.jpg"] }] }; };
  query.update = (value: Record<string, unknown>) => {
    update = value;
    return { eq: (...args: unknown[]) => { calls.push(["update-eq", ...args]); return updateChain; } };
  };
  const updateChain = {
    eq: (...args: unknown[]) => { calls.push(["update-eq", ...args]); return updateChain; },
    is: (...args: unknown[]) => { calls.push(["update-is", ...args]); return updateChain; },
    select: async () => ({ data: [{ id: "row" }] }),
  };
  const handler = load("claim-guest-valuations", {
    guard: async () => ({ userId: "owner" }),
    adminClient: () => ({ from: () => query, storage: { from: () => ({ move: async (from: string, to: string) => {
      moves.push([from, to]); return { error: from.endsWith("1.jpg") ? { message: "test move failure" } : null };
    } }) } }),
  });
  const response = await handler(request({ guestToken: token }));
  expect(await response.json()).toEqual({ claimed: 1 });
  expect(calls).toContainEqual(["limit", 50]);
  expect(calls).toContainEqual(["is", "user_id", null]);
  expect(calls).toContainEqual(["update-is", "user_id", null]);
  expect(moves).toEqual([["guest/row/0.jpg", "owner/guest-row-0.jpg"], ["guest/row/1.jpg", "owner/guest-row-1.jpg"]]);
  expect(update).toEqual({ user_id: "owner", guest_token_hash: null, photo_urls: ["owner/guest-row-0.jpg", "guest/row/1.jpg", "guest/other/2.jpg"] });
});

test("guest photos accept at most 6 JPEG PNG WebP images each no larger than 1.5 MiB", async () => {
  const source = readFileSync(new URL("./analyse-vehicle/index.ts", import.meta.url), "utf8");
  const start = source.indexOf("    const guestLabeled:");
  const end = source.indexOf("    const rawLabeled:", start);
  const run = new Function("body", "guestValuationId", "adminClient", "VALID_SLOTS", "PHOTO_BUCKET",
    `return (async () => { ${transpiler.transformSync(source.slice(start, end))} return guestLabeled; })();`);
  const upload = async () => ({ error: null });
  const admin = () => ({ storage: { from: () => ({ upload }) } });
  const photo = (mime: string, bytes: number) => ({ slot: "front", dataUrl: `data:image/${mime};base64,${Buffer.alloc(bytes).toString("base64")}` });
  const result = await run({ guestPhotos: [photo("jpeg", 1), photo("png", 1), photo("webp", 1), photo("gif", 1), photo("jpeg", 1572865), photo("jpeg", 1572864), photo("jpeg", 1)] }, "row", admin, ["front", "other"], "vehicle-photos");
  expect(result.map((p: { ref: string }) => p.ref)).toEqual(["guest/row/0.jpg", "guest/row/1.png", "guest/row/2.webp", "guest/row/5.jpg"]);
});