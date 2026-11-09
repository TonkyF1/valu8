import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { plateAgeYear, assessImport, importNote, isJdmImportModel } from "./importCheck.ts";
const now = new Date("2026-11-09");
Deno.test("plate age identifiers (informational only)", () => {
  assertEquals(plateAgeYear("SK51 EYX", now), 2001);
  assertEquals(plateAgeYear("AB02CDE", now), 2002);
  assertEquals(plateAgeYear("AB75CDE", now), 2025);
  assertEquals(plateAgeYear("R123ABC", now), 1997);
  assertEquals(plateAgeYear("ABC123X", now), 1982);
  assertEquals(plateAgeYear("Q123ABC", now), "Q");
  assertEquals(plateAgeYear("1 ABC", now), null);
});
Deno.test("SK51EYX: DVSA manufacture 2001, first UK reg 2005 -> likely import built 2001", () => {
  const a = assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", manufactureDate: "2001-01-01", make: "HONDA", model: "Integra", now });
  assertEquals(a.status, "likely"); assertEquals(a.buildYear, 2001);
  // analyse-vehicle passes the manufacture year as a number
  assertEquals(assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", manufactureDate: 2001, make: "HONDA", model: "Integra", now }).status, "likely");
});
Deno.test("SK51EYX without manufactureDate: still likely (Integra not sold new in UK after 2001), year not guessed from plate", () => {
  const a = assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", make: "HONDA", model: "Integra", now });
  assertEquals(a.status, "likely"); assertEquals(a.buildYear, undefined);
});
Deno.test("T80GOU: cherished T plate on a 2016 Corsa is not an import", () => {
  const a = assessImport({ registration: "T80GOU", firstRegistered: "2016-03-31", make: "VAUXHALL", model: "Corsa", now });
  assertEquals(a.status, "no"); assertEquals(a.buildYear, undefined); assertEquals(importNote(a), null);
  assertEquals(assessImport({ registration: "T80 GOU", firstRegistered: "2016-03-31", manufactureDate: "2016-03-01", make: "VAUXHALL", model: "Corsa", now }).status, "no");
});
Deno.test("GB51DLB: 51 plate on a 2012 Smart Fortwo is not an import", () => {
  const a = assessImport({ registration: "GB51DLB", firstRegistered: "2012-06-28", make: "SMART (MCC)", model: "Fortwo Coupe", now });
  assertEquals(a.status, "no"); assertEquals(importNote(a), null);
});
Deno.test("older-looking plate on a UK model is never flagged on the plate alone", () => {
  assertEquals(assessImport({ registration: "SK51EYX", firstRegistered: "2005-03-21", make: "FORD", model: "Focus", now }).status, "no");
  assertEquals(assessImport({ registration: "A1", firstRegistered: "2020-01-01", make: "BMW", model: "3 Series", now }).status, "no");
});
Deno.test("manufactureDate well before UK registration wins", () => {
  const a = assessImport({ registration: "AB12CDE", firstRegistered: "2012-04-01", manufactureDate: "1999-06-01", make: "Nissan", model: "Skyline", now });
  assertEquals(a.status, "likely"); assertEquals(a.buildYear, 1999);
  const b = assessImport({ registration: "AB12CDE", firstRegistered: "2012-04-01", manufactureDate: "2009-06-01", make: "Ford", model: "Focus", now });
  assertEquals(b.status, "likely"); assertEquals(b.buildYear, 2009);
  // 1 year gap (built late in one year, registered the next) is normal
  assertEquals(assessImport({ registration: "AB12CDE", firstRegistered: "2012-04-01", manufactureDate: "2011-11-01", make: "Ford", model: "Focus", now }).status, "no");
});
Deno.test("Q plate is only 'possible'", () => {
  assertEquals(assessImport({ registration: "Q123ABC", firstRegistered: "2010-01-01", make: "Ford", model: "Focus", now }).status, "possible");
});
Deno.test("normal UK car", () => {
  assertEquals(assessImport({ registration: "AB15CDE", firstRegistered: "2015-03-02", make: "Ford", model: "Fiesta", now }).status, "no");
  assertEquals(isJdmImportModel("Honda", "Integra", 1999), false);
  assertEquals(isJdmImportModel("Nissan", "Skyline", 2003), true);
});
