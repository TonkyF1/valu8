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
  assertEquals(gearboxFromListings(rows(7, 2)).gearbox, undefined); // MINI "Cooper" case: 9 adverts is too few
});
Deno.test("gearbox: mixed model stays unknown but keeps the automatic share", () => {
  const g = gearboxFromListings(rows(18, 12));
  assertEquals(g.gearbox, undefined);
  assertEquals(g.autoShare, 0.6);
  assertEquals(gearboxFromListings(rows(6, 4)).autoShare, null); // under 20 adverts: no share
});
Deno.test("gearbox: too few adverts = unknown, no share", () => {
  const g = gearboxFromListings(rows(19, 0));
  assertEquals(g.gearbox, undefined);
  assertEquals(g.autoShare, null);
});
Deno.test("gearbox: blank rows ignored; text detection", () => {
  assertEquals(gearboxFromListings([...rows(25, 0), { gearbox: null }, { gearbox: "" }]).n, 25);
  assertEquals(isAutoText("DSG"), true);
  assertEquals(isAutoText("Manual"), false);
  assertEquals(hasGearbox(""), false);
  assertEquals(hasGearbox(undefined), false);
  assertEquals(hasGearbox("manual"), true);
});
