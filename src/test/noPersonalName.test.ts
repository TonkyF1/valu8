import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_NAME, FOUNDER_PHOTO_ALT, operatorSentence } from "@/lib/legal";

/** Tony asked (22 Nov 2026) for his name to be removed from everything public. */
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("no personal name on the site", () => {
  it("publishes no legal name; the operator is Valu8 (valu8.uk)", () => {
    expect(LEGAL_NAME).toBe("");
    expect(operatorSentence()).toBe("Valu8 (valu8.uk) is the data controller for the personal data described here.");
    expect(FOUNDER_PHOTO_ALT).not.toMatch(/tony|fisher/i);
  });
  it("no page, data file, public file or email template contains the name", () => {
    const files = [...walk("src").filter((f) => !f.includes(`${join("src", "test")}`)), ...walk("supabase/functions"), "index.html", ...walk("public").filter((f) => /\.(html|txt|xml|json)$/.test(f))];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/fisher/i);
  });
});
