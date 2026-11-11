import { describe, expect, it } from "vitest";
import { paintFor, paintMask, tintPixels } from "@/components/tesla/carPaint";

describe("paintFor", () => {
  it("maps DVSA colours to paint tones", () => {
    for (const c of ["RED", "BLUE", "BLACK", "SILVER", "GREY", "GREEN", "YELLOW", "ORANGE", "BEIGE", "BRONZE", "GOLD", "MAROON", "PURPLE", "PINK", "TURQUOISE", "CREAM", "BROWN"]) {
      expect(paintFor(c)).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(paintFor("red")).toBe(paintFor("RED"));
    expect(paintFor(" Gray ")).toBe(paintFor("GREY"));
  });
  it("keeps the white render for white, multi-colour, unknown and blank", () => {
    for (const c of ["WHITE", "MULTI-COLOUR", "Multi Colour", "NOT STATED", "", undefined, null]) expect(paintFor(c)).toBeNull();
  });
});

// A 60x20 test render: columns 0-19 lit white paint, 20-39 shadowed paint, 40-49 dark backdrop, 50-59 red rear light.
const W = 60, H = 20;
function render(noise = 0) {
  const p = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const n = noise && x < 40 ? (((x >> 2) + (y >> 2)) % 2 ? noise : -noise) : 0; // blocky compression-style noise
    const c = x < 20 ? [235, 235, 235] : x < 40 ? [175, 175, 175] : x < 50 ? [17, 17, 17] : [190, 25, 30];
    p.set([c[0] + n, c[1] + n, c[2] + n, 255], i);
  }
  return p;
}
const at = (p: Uint8ClampedArray, x: number, y = 10) => [...p.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];

describe("tintPixels", () => {
  it("only paints bright neutral pixels", () => {
    expect(paintMask(235, 235, 235)).toBeGreaterThan(0.99); // white paint
    expect(paintMask(17, 17, 17)).toBe(0); // backdrop / tyre
    expect(paintMask(40, 45, 50)).toBe(0); // glass
    expect(paintMask(200, 30, 30)).toBe(0); // rear light
  });
  it("recolours paint, keeps shading and leaves the backdrop and lights alone", () => {
    const p = render();
    tintPixels(p, W, H, "#1F3F7A");
    const lit = at(p, 10), shadow = at(p, 30);
    expect(lit[2]).toBeGreaterThan(lit[0] + 20); // lit paint turns blue
    expect(lit[2]).toBeGreaterThan(shadow[2]); // lit panel stays brighter than the shadowed one
    expect(at(p, 46)).toEqual([17, 17, 17]);
    expect(at(p, 56)).toEqual([190, 25, 30]);
  });
  it("smooths compression blocks instead of amplifying them", () => {
    // One evenly lit panel (200) with ±3 blocky noise, like a compressed WebP.
    const p = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = x < 40 ? 200 + (((x >> 2) + (y >> 2)) % 2 ? 3 : -3) : 17;
      p.set([v, v, v, 255], (y * W + x) * 4);
    }
    tintPixels(p, W, H, "#1F3F7A");
    const blues = [];
    for (let y = 4; y < 16; y++) for (let x = 4; x < 32; x++) blues.push(at(p, x, y)[2]);
    expect(Math.max(...blues) - Math.min(...blues)).toBeLessThanOrEqual(2); // source swings by 6
  });
});
