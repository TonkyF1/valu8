import { describe, it, expect } from "vitest";
import {
  platesMatch, colourFamily, coloursCompatible, declaredDamage, checkPhotos, applyPhotoCheck, checkedConditionScore,
} from "../../supabase/functions/_shared/photoSanity";

describe("colourFamily", () => {
  it("maps DVLA and AI wording to families", () => {
    expect(colourFamily("GREY")).toBe("grey");
    expect(colourFamily("dark blue metallic")).toBe("blue");
    expect(colourFamily("Midnight blue")).toBe("blue");
    expect(colourFamily("Frozen White")).toBe("white");
    expect(colourFamily("MULTI-COLOUR")).toBeNull();
    expect(colourFamily("")).toBeNull();
    expect(colourFamily(undefined)).toBeNull();
  });
  it("treats lighting-confusable colours as compatible", () => {
    expect(coloursCompatible("silver", "grey")).toBe(true);
    expect(coloursCompatible("black", "blue")).toBe(true);
    expect(coloursCompatible("red", "blue")).toBe(false);
    expect(coloursCompatible("white", "red")).toBe(false);
    expect(coloursCompatible(null, "red")).toBe(true);
  });
});

describe("declaredDamage", () => {
  it("finds unnegated damage words", () => {
    expect(declaredDamage("Small scuff on rear bumper. FSH.")).toEqual(["scuff"]);
    expect(declaredDamage("Kerbed alloys, dent in driver door")).toEqual(expect.arrayContaining(["kerbed alloy", "dent"]));
  });
  it("ignores negated, repaired and wear-and-tear phrases", () => {
    expect(declaredDamage("No scratches or dents")).toEqual([]);
    expect(declaredDamage("Dent has been repaired")).toEqual([]);
    expect(declaredDamage("Usual wear and tear for age")).toEqual([]);
    expect(declaredDamage("")).toEqual([]);
  });
});

describe("checkPhotos", () => {
  const base = { photoCount: 4, registration: "AB12 CDE", dvlaColour: "GREY" };

  it("passes one consistent car matching DVLA", () => {
    const c = checkPhotos({ ...base, aiSameCar: true, photoCars: [
      { photoIndex: 1, exterior: true, colour: "silver", plate: "AB12CDE" },
      { photoIndex: 2, exterior: true, colour: "grey", plate: "" },
      { photoIndex: 3, exterior: false, colour: "", plate: "" },
    ] });
    expect(c.trusted).toBe(true);
    expect(c.notes).toEqual([]);
  });

  it("flags three different-coloured cars (the audit Fiesta case)", () => {
    const c = checkPhotos({ ...base, dvlaColour: "BLUE", aiSameCar: true, photoCars: [
      { photoIndex: 1, exterior: true, colour: "blue" },
      { photoIndex: 2, exterior: true, colour: "red" },
      { photoIndex: 3, exterior: true, colour: "white" },
    ] });
    expect(c.differentCars).toBe(true);
    expect(c.trusted).toBe(false);
    expect(c.notes[0]).toMatch(/more than one car/);
  });

  it("trusts the model saying the photos are different cars", () => {
    expect(checkPhotos({ ...base, aiSameCar: false, photoCars: [] }).differentCars).toBe(true);
  });

  it("flags two different readable plates", () => {
    const c = checkPhotos({ ...base, photoCars: [
      { exterior: true, colour: "grey", plate: "AB12CDE" }, { exterior: true, colour: "grey", plate: "XY65 ZZZ" },
    ] });
    expect(c.differentCars).toBe(true);
  });

  it("tolerates plate misreads: look-alikes, one wrong character, a partial read", () => {
    for (const plate of ["AB12 CDE", "A812CDE", "AB12CDF", "B12CDE", "AB12C"]) {
      const c = checkPhotos({ ...base, photoCars: [{ exterior: true, colour: "grey", plate }, { exterior: true, colour: "grey", plate: "AB12CDE" }] });
      expect(c.plateMismatch, plate).toBe(false);
      expect(c.differentCars, plate).toBe(false);
      expect(c.trusted, plate).toBe(true);
    }
    expect(platesMatch("AB12CDE", "XY65ZZZ")).toBe(false);
  });

  it("flags a plate that isn't the entered registration", () => {
    const c = checkPhotos({ ...base, photoCars: [{ exterior: true, colour: "grey", plate: "XY65ZZZ" }] });
    expect(c.plateMismatch).toBe(true);
    expect(c.trusted).toBe(false);
  });

  it("flags a colour that contradicts DVLA, politely mentioning resprays", () => {
    const c = checkPhotos({ ...base, dvlaColour: "RED", photoCars: [
      { exterior: true, colour: "blue" }, { exterior: true, colour: "light blue" },
    ] });
    expect(c.colourMismatch).toBe(true);
    expect(c.notes[0]).toMatch(/looks blue.*DVLA record says red.*resprayed/);
  });

  it("does nothing without photos", () => {
    const c = checkPhotos({ photoCount: 0, dvlaColour: "RED", photoCars: [{ exterior: true, colour: "blue" }] });
    expect(c.trusted).toBe(true);
    expect(c.notes).toEqual([]);
  });

  it("acknowledges declared damage", () => {
    const c = checkPhotos({ ...base, declaredText: "small scuff on rear bumper", photoCars: [{ exterior: true, colour: "grey" }] });
    expect(c.trusted).toBe(true);
    expect(c.declaredDamage).toEqual(["scuff"]);
    expect(c.notes[0]).toMatch(/You mentioned a scuff/);
  });
});

describe("applyPhotoCheck / checkedConditionScore", () => {
  const items = [
    { observation: "Clean paintwork, no visible scuffs", severity: "positive", priceImpact: 150 },
    { observation: "Kerbed front alloy", severity: "minor", priceImpact: -80, fixCost: 90, fixable: true },
  ];

  it("removes every £ impact and positive tag when photos are untrusted", () => {
    const c = checkPhotos({ photoCount: 3, aiSameCar: false });
    const out = applyPhotoCheck(items, c);
    expect(out.every((i) => i.priceImpact === undefined)).toBe(true);
    expect(out[0].severity).toBe("neutral");
    expect(checkedConditionScore(7.2, c)).toBeNull();
  });

  it("never lets a 'clean' photo add value when damage was declared", () => {
    const c = checkPhotos({ photoCount: 3, declaredText: "scuff on rear bumper", photoCars: [{ exterior: true, colour: "grey" }] });
    const out = applyPhotoCheck(items, c);
    expect(out[0].priceImpact).toBeUndefined();
    expect(out[0].severity).toBe("neutral");
    expect(out[1].priceImpact).toBe(-80);
    expect(checkedConditionScore(9, c)).toBe(7.5);
    expect(checkedConditionScore(6, c)).toBe(6);
  });

  it("leaves a normal, consistent upload alone", () => {
    const c = checkPhotos({ photoCount: 3, dvlaColour: "GREY", photoCars: [{ exterior: true, colour: "grey" }] });
    expect(applyPhotoCheck(items, c)).toEqual(items);
    expect(checkedConditionScore(8.1, c)).toBe(8.1);
  });
});

describe("analyse-vehicle wiring (source checks)", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const src = readFileSync(resolve(__dirname, "../../supabase/functions/analyse-vehicle/index.ts"), "utf8");
  it("asks the vision model for per-photo colour/plate and a same-car answer", () => {
    expect(src).toContain("...PHOTO_IDENTITY_SCHEMA,");
    expect(src).toContain("${PHOTO_IDENTITY_PROMPT}");
  });
  it("checks photos before pricing and uses the checked score and insights", () => {
    const at = src.indexOf("const photoCheck = checkPhotos(");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf("const score = photoScore ?? neutralConditionScore();"));
    expect(src).toContain("ai.photoInsights = applyPhotoCheck(ai.photoInsights ?? [], photoCheck);");
    expect(src).toContain("const photoScore = checkedConditionScore(photoConditionScore(ai.conditionScore, photoUrls.length), photoCheck);");
  });
  it("tells the seller politely and never renders a null score for photo reports", () => {
    expect(src).toContain('conditionLabel: photosUntrusted ? "Not scored (photos didn\'t match)"');
    expect(src).toContain("conditionScore: photosUntrusted ? neutralConditionScore() : photoScore,");
    expect(src).toContain("const lead = [...(photoCheck.notes ?? []), ...(mileageNote ? [mileageNote] : [])];");
  });
});
