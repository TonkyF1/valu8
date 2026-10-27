import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useSeo } from "@/lib/seo";

function Page({ noindex }: { noindex: boolean }) {
  useSeo({ title: "SEO check", description: "SEO check description", path: "/accuracy", noindex });
  return null;
}

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="robots"]').forEach((tag) => tag.remove());
});

describe("served shell robots", () => {
  it("reuses existing robots instead of adding a duplicate", () => {
    document.head.insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex">');
    render(<Page noindex />);
    expect(document.head.querySelectorAll('meta[name="robots"]').length).toBe(1);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
  });
  it("clears a fallback shell's noindex on an indexable page", () => {
    document.head.insertAdjacentHTML("beforeend", '<meta name="robots" content="noindex">');
    render(<Page noindex={false} />);
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});