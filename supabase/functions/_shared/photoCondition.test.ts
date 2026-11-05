import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { photoConditionScore, neutralConditionScore, expertInsightFromCondition } from "./photoCondition.ts";

Deno.test("photoConditionScore: null without photos even if AI invents 4.5", () => {
  assertEquals(photoConditionScore(4.5, 0), null);
  assertEquals(photoConditionScore(4.5, undefined as unknown as number), null);
  assertEquals(photoConditionScore(4.5, 3), 4.5);
  assertEquals(photoConditionScore(11, 1), 10);
  assertEquals(photoConditionScore("nope", 2), null);
});

Deno.test("expertInsightFromCondition: never mentions photos when photoCount is 0", () => {
  const none = expertInsightFromCondition({ photoCount: 0, conditionScore: 4.5, marketSampleLabel: "282" });
  assertEquals(none.majorConditionIssue, false);
  assertEquals(none.reason, "");

  const withPhotos = expertInsightFromCondition({ photoCount: 4, conditionScore: 4.5, marketSampleLabel: "282" });
  assertEquals(withPhotos.majorConditionIssue, true);
  assertEquals(withPhotos.reason.includes("photos"), true);
  assertEquals(withPhotos.reason.includes("4.5"), true);

  const good = expertInsightFromCondition({ photoCount: 4, conditionScore: 7.2 });
  assertEquals(good.majorConditionIssue, false);
});

Deno.test("neutralConditionScore is mid-band (no price swing)", () => {
  assertEquals(neutralConditionScore(), 7);
});
