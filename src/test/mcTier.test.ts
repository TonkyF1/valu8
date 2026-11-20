import { describe, it, expect } from "vitest";
import { pickMcTier, pickMcCandidate } from "../../supabase/functions/_shared/mcTier";

type R = { listings: number[]; id: number };
const mk = (id: number, n: number | null): R | null => (n === null ? null : { id, listings: Array(n).fill(0) });

/** The original one-at-a-time cascade, verbatim in logic. */
function sequential(results: (R | null)[], mins: number[]): R | null {
  const last = results.length - 1;
  let r: R | null = null;
  for (let i = 0; i < last; i++) {
    r = results[i];
    if (r && r.listings.length >= mins[i]) return r;
  }
  const wide = results[last];
  return wide && wide.listings.length > (r?.listings.length ?? 0) ? wide : r;
}
/** The new wave-based driver (waves of 3), same code shape as analyse-vehicle. */
function waves(results: (R | null)[], mins: number[], wave = 3): { pick: R | null; fetched: number } {
  const got: (R | null)[] = [];
  for (let i = 0; i < results.length; i += wave) {
    got.push(...results.slice(i, i + wave));
    const d = pickMcTier<R>(got, mins, results.length);
    if (d.done) return { pick: d.pick, fetched: got.length };
  }
  return { pick: pickMcTier<R>(got, mins, results.length).pick, fetched: got.length };
}

function rng(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

describe("parallel MarketCheck cascade picks the same tier as the sequential one", () => {
  for (const shape of [{ name: "no trim (5 tiers)", mins: [5, 3, 5, 5, 0] }, { name: "with trim (8 tiers)", mins: [5, 3, 3, 5, 3, 5, 5, 0] }]) {
    it(`randomised: ${shape.name}`, () => {
      const rand = rng(42);
      for (let t = 0; t < 5000; t++) {
        const results = shape.mins.map((_, i) => {
          const x = rand();
          return mk(i, x < 0.2 ? null : Math.floor(rand() * 9));
        });
        expect(waves(results, shape.mins).pick).toBe(sequential(results, shape.mins));
      }
    });
  }
  it("stops early once a wave contains a good tier", () => {
    const mins = [5, 3, 3, 5, 3, 5, 5, 0];
    const results = [mk(0, 2), mk(1, 4), mk(2, 9), mk(3, 9), mk(4, 9), mk(5, 9), mk(6, 9), mk(7, 9)];
    const r = waves(results, mins);
    expect(r.pick?.id).toBe(1); // first good in priority order, not the biggest
    expect(r.fetched).toBe(3);
  });
  it("wide net only wins when strictly bigger than the tier before it", () => {
    const mins = [5, 3, 5, 5, 0];
    expect(waves([mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 4), mk(4, 4)], mins).pick?.id).toBe(3);
    expect(waves([mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 4), mk(4, 5)], mins).pick?.id).toBe(4);
    expect(waves([mk(0, null), mk(1, null), mk(2, null), mk(3, null), mk(4, 2)], mins).pick?.id).toBe(4);
    expect(waves([mk(0, null), mk(1, null), mk(2, null), mk(3, null), mk(4, null)], mins).pick).toBeNull();
  });
});

describe("candidate model names", () => {
  it("matches the old sequential loop", () => {
    const old = (rs: (R | null)[]) => { let best: R | null = null; for (const r of rs) { if (r && r.listings.length >= 3) return r; if (r && r.listings.length > (best?.listings.length ?? 0)) best = r; } return best; };
    const rand = rng(7);
    for (let t = 0; t < 3000; t++) {
      const rs = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, i) => mk(i, rand() < 0.25 ? null : Math.floor(rand() * 6)));
      expect(pickMcCandidate<R>(rs)).toBe(old(rs));
    }
  });
});
