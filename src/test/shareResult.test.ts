import { describe, it, expect } from "vitest";
import { buildShareUrl, shareIntentUrl } from "@/components/ShareResult";
describe("share", () => {
  it("links model page, no personal data", () => {
    expect(buildShareUrl({ make: "FORD", model: "FIESTA ZETEC", platform: "whatsapp", campaign: "result_card", ref: "abc12345" }))
      .toBe("https://valu8.uk/car-values/ford/fiesta?utm_source=whatsapp&utm_medium=share&utm_campaign=result_card&ref=abc12345");
    expect(buildShareUrl({ make: "Dacia", model: "Sandero", platform: "x", campaign: "c", ref: "BAD REF" })).toBe("https://valu8.uk/?utm_source=x&utm_medium=share&utm_campaign=c");
    expect(shareIntentUrl("whatsapp", "hi £1", "https://valu8.uk/")).toContain("wa.me/?text=hi%20%C2%A31%20https");
  });
});
