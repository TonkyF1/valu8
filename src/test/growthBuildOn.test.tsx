// "Build on what's working" (GSC, Nov 2026): /value pages rank 5-20 for "how much is my X worth", "X value" and
// "sell my X". Every page answers those in its lead copy and H2s; metas lead with the question and the free instant
// valuation; electric model pages link to the EV value guide.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ModelValue from "@/pages/ModelValue";
import { MODEL_PRICES } from "@/data/modelPriceBands";
import { EV_VALUE_SLUGS, valueIntro, valueMeta, valueName, valueBodyHtml } from "@/data/valuePages";

const RISERS = ["ford-kuga", "vauxhall-astra", "ford-fiesta", "nissan-note", "hyundai-kona", "seat-leon", "toyota-c-hr", "volkswagen-t-roc", "volkswagen-polo", "kia-ceed"];
const by = (s: string) => MODEL_PRICES.find((m) => m.slug === s)!;

describe("build on what's working: /value copy", () => {
  it.each(RISERS)("%s: lead copy and H2s use the searched wording", (slug) => {
    const m = by(slug); expect(m, slug).toBeDefined();
    const name = valueName(m);
    expect(valueIntro(m).startsWith(`How much is my ${name} worth?`)).toBe(true);
    expect(valueIntro(m)).toContain("not a valuation");
    const html = valueBodyHtml(m);
    expect(html).toContain(`<h2>${name} value by year</h2>`);
    expect(html).toContain(`Selling your ${name}: private sale, part-exchange or dealer price?`);
  });
  it("every model meta asks the question, offers the free instant valuation and fits 155 characters, with no em dash", () => {
    for (const m of MODEL_PRICES) {
      const d = valueMeta(m).description;
      expect(d.length, m.slug).toBeLessThanOrEqual(155);
      expect(d, m.slug).toContain(`How much is your ${valueName(m)} worth?`);
      expect(d, m.slug).toMatch(/free instant (\w+ )*valuation by reg/i);
      expect(d, m.slug).not.toContain("—");
    }
  });
  it("electric model pages link to /guides/electric-car-value in build HTML and React", () => {
    for (const slug of EV_VALUE_SLUGS) {
      const m = by(slug); if (!m) continue;
      expect(valueBodyHtml(m), slug).toContain('href="/guides/electric-car-value"');
    }
    expect(valueBodyHtml(by("ford-fiesta"))).not.toContain('href="/guides/electric-car-value"');
    const { container } = render(<MemoryRouter initialEntries={["/value/tesla-model-y"]}><Routes><Route path="/value/:slug" element={<ModelValue />} /></Routes></MemoryRouter>);
    expect(container.querySelector('a[href="/guides/electric-car-value"]')).not.toBeNull();
  });
});
