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

describe("tintPixels", () => {
  const px = (...rgb: number[][]) => new Uint8ClampedArray(rgb.flatMap((c) => [...c, 255]));
  it("only paints bright neutral pixels", () => {
    expect(paintMask(235, 235, 235)).toBeGreaterThan(0.99); // white paint
    expect(paintMask(17, 17, 17)).toBe(0); // backdrop / tyre
    expect(paintMask(40, 45, 50)).toBe(0); // glass
    expect(paintMask(200, 30, 30)).toBe(0); // rear light
  });
  it("recolours paint, leaves the rest alone and keeps shading", () => {
    const p = px([235, 235, 235], [150, 150, 150], [17, 17, 17], [190, 25, 30]);
    tintPixels(p, "#1F3F7A");
    expect(p[2]).toBeGreaterThan(p[0]); // lit paint turns blue
    expect(p[2]).toBeGreaterThan(p[6] - 1); // shading kept: lit panel brighter than shadowed one
    expect([...p.slice(8, 11)]).toEqual([17, 17, 17]);
    expect([...p.slice(12, 15)]).toEqual([190, 25, 30]);
  });
});
