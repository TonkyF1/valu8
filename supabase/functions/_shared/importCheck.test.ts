import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { plateAgeYear, assessImport, isJdmImportModel } from "./importCheck.ts";
const now = new Date("2026-11-09");
Deno.test("plate age identifiers", () => {
  assertEquals(plateAgeYear("SK51 EYX", now), 2001);
  assertEquals(plateAgeYear("AB02CDE", now), 2002);
  assertEquals(plateAgeYear("AB75CDE", now), 2025);
  assertEquals(plateAgeYear("R123ABC", now), 1997);
  assertEquals(plateAgeYear("ABC123X", now), 1982);
  assertEquals(plateAgeYear("Q123ABC", now), "Q");
  assertEquals(plateAgeYear("1 ABC", now), null);
});
Deno.test("SK51EYX: JDM Integra on age-related plate is a likely import built ~2001", () => {
  const a = assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", make: "HONDA", model: "Integra", now });
  assertEquals(a.status, "likely"); assertEquals(a.buildYear, 2001);
});
Deno.test("non-JDM car with older-looking plate is only 'possible' and keeps its year", () => {
  const a = assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", make: "FORD", model: "Focus", now });
  assertEquals(a.status, "possible"); assertEquals(a.buildYear, undefined);
});
Deno.test("manufactureDate well before UK registration wins", () => {
  const a = assessImport({ registration: "AB12CDE", firstRegistered: "2012-04-01", manufactureDate: "1999-06-01", make: "Nissan", model: "Skyline", now });
  assertEquals(a.status, "likely"); assertEquals(a.buildYear, 1999);
});
Deno.test("normal UK car", () => {
  assertEquals(assessImport({ registration: "AB15CDE", firstRegistered: "2015-03-02", make: "Ford", model: "Fiesta", now }).status, "no");
  assertEquals(isJdmImportModel("Honda", "Integra", 1999), false);
  assertEquals(isJdmImportModel("Nissan", "Skyline", 2003), true);
});
