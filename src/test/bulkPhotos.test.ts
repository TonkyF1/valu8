import { describe, expect, it } from "vitest";
import { fillEmptySlots } from "@/lib/cars";

describe("bulk photo upload", () => {
  it("fills empty cards in order", () => {
    expect(fillEmptySlots([], ["a", "b", "c"]).map((x) => x.key)).toEqual(["front", "rear", "side"]);
  });
  it("skips cards that already have a photo", () => {
    expect(fillEmptySlots(["front", "side"], ["a", "b"])).toEqual([{ key: "rear", file: "a" }, { key: "interior", file: "b" }]);
  });
  it("takes at most 6 photos", () => {
    expect(fillEmptySlots([], ["1", "2", "3", "4", "5", "6", "7", "8"])).toHaveLength(6);
  });
  it("adds nothing when every card is full", () => {
    expect(fillEmptySlots(["front", "rear", "side", "interior", "odometer", "engine"], ["a"])).toEqual([]);
  });
});
