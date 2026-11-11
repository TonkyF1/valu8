import { assertEquals } from "jsr:@std/assert@1";
import { gearboxFromListings, hasGearbox, isAutoText } from "./gearbox.ts";

const rows = (a: number, m: number, semi = 0) => [
  ...Array(a).fill({ gearbox: "Automatic" }), ...Array(semi).fill({ gearbox: "Semi-Auto" }), ...Array(m).fill({ gearbox: "Manual" }),
];

Deno.test("gearbox: BMW X3-like mix (60 auto, 17 semi-auto, 1 manual) is Automatic", () => {
  const g = gearboxFromListings(rows(60, 1, 17));
  assertEquals(g.gearbox, "Automatic");
  assertEquals(g.n, 78);
});
Deno.test("gearbox: mostly manual hatch is Manual", () => {
  assertEquals(gearboxFromListings(rows(2, 18)).gearbox, "Manual");
});
Deno.test("gearbox: mixed model stays unknown but keeps the automatic share", () => {
  const g = gearboxFromListings(rows(6, 4));
  assertEquals(g.gearbox, undefined);
  assertEquals(g.autoShare, 0.6);
});
Deno.test("gearbox: too few adverts = unknown, no share", () => {
  const g = gearboxFromListings(rows(3, 0));
  assertEquals(g.gearbox, undefined);
  assertEquals(g.autoShare, null);
});
Deno.test("gearbox: blank rows ignored; text detection", () => {
  assertEquals(gearboxFromListings([...rows(5, 0), { gearbox: null }, { gearbox: "" }]).n, 5);
  assertEquals(isAutoText("DSG"), true);
  assertEquals(isAutoText("Manual"), false);
  assertEquals(hasGearbox(""), false);
  assertEquals(hasGearbox(undefined), false);
  assertEquals(hasGearbox("manual"), true);
});
