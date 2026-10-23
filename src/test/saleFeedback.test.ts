import { describe, it, expect } from "vitest";
import { validateSaleFeedback, getSaleFeedback, withSaleFeedback, stripSaleFeedback, needsSaleFeedbackPrompt, saleAccuracy } from "@/lib/saleFeedback";

const now = new Date("2026-10-23T12:00:00");
const fb = { salePrice: 8000, recordedAt: "2026-10-20T00:00:00Z" };

describe("validateSaleFeedback", () => {
  it("accepts £ and commas and rounds", () => {
    expect(validateSaleFeedback({ salePrice: "£8,250.40" }, now)).toEqual({ ok: true, value: { salePrice: 8250, soldOn: null, soldTo: null } });
  });
  it("rejects empty, zero, negative, junk and absurd prices", () => {
    for (const p of ["", "0", "-5", "abc", "5000000"]) expect(validateSaleFeedback({ salePrice: p }, now).ok).toBe(false);
  });
  it("validates date and sold-to", () => {
    expect(validateSaleFeedback({ salePrice: 5000, soldOn: "2026-10-01", soldTo: "part_ex" }, now)).toMatchObject({ ok: true, value: { soldOn: "2026-10-01", soldTo: "part_ex" } });
    expect(validateSaleFeedback({ salePrice: 5000, soldOn: "2026-12-01" }, now).ok).toBe(false);
    expect(validateSaleFeedback({ salePrice: 5000, soldOn: "01/10/2026" }, now).ok).toBe(false);
    expect(validateSaleFeedback({ salePrice: 5000, soldTo: "auction" }, now).ok).toBe(false);
  });
});

describe("report merge / strip", () => {
  it("merges without touching other fields and can clear", () => {
    const r = { values: { privateSale: 9000 }, conditionScore: 7 };
    const m = withSaleFeedback(r, fb);
    expect(m).toEqual({ ...r, saleFeedback: fb });
    expect(r).not.toHaveProperty("saleFeedback");
    expect(withSaleFeedback(m, null)).toEqual(r);
    expect(getSaleFeedback(m)).toEqual(fb);
    expect(getSaleFeedback(r)).toBeNull();
    expect(getSaleFeedback(null)).toBeNull();
  });
  it("strips feedback for share views", () => {
    expect(stripSaleFeedback({ a: 1, saleFeedback: fb })).toEqual({ a: 1 });
    expect(stripSaleFeedback(null)).toBeNull();
  });
});

describe("needsSaleFeedbackPrompt", () => {
  const base = { private_value: 9000, report: {} };
  it("only prompts after 14 days", () => {
    expect(needsSaleFeedbackPrompt({ ...base, created_at: "2026-10-10T12:00:00" }, now)).toBe(false);
    expect(needsSaleFeedbackPrompt({ ...base, created_at: "2026-10-09T12:00:00" }, now)).toBe(true);
  });
  it("never prompts when feedback exists, no value, or valuation unavailable", () => {
    const old = "2026-01-01T00:00:00";
    expect(needsSaleFeedbackPrompt({ ...base, created_at: old, report: { saleFeedback: fb } }, now)).toBe(false);
    expect(needsSaleFeedbackPrompt({ created_at: old, private_value: null, report: {} }, now)).toBe(false);
    expect(needsSaleFeedbackPrompt({ ...base, created_at: old, report: { valuationUnavailable: true } }, now)).toBe(false);
  });
});

describe("saleAccuracy", () => {
  it("computes signed % difference", () => {
    expect(saleAccuracy(9500, 10000)).toBe(-5);
    expect(saleAccuracy(11000, 10000)).toBe(10);
    expect(saleAccuracy(5000, null)).toBeNull();
  });
});
