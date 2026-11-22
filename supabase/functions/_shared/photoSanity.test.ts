import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkPhotos, applyPhotoCheck, checkedConditionScore } from "./photoSanity.ts";

Deno.test("photoSanity: three different-coloured cars never get value-add", () => {
  const c = checkPhotos({ photoCount: 4, dvlaColour: "BLUE", photoCars: [
    { exterior: true, colour: "blue" }, { exterior: true, colour: "red" }, { exterior: true, colour: "white" },
  ] });
  assertEquals(c.trusted, false);
  const out = applyPhotoCheck([{ observation: "Clean bodywork", severity: "positive", priceImpact: 200 }], c);
  assertEquals(out[0].priceImpact, undefined);
  assertEquals(out[0].severity, "neutral");
  assertEquals(checkedConditionScore(7.2, c), null);
});
