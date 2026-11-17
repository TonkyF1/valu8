import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { closeKeyboard, lockBodyScroll, scrollPageTop } from "@/lib/scrollTop";
import { CheckoutSheet } from "@/components/tesla/CheckoutSheet";
import { RouteScrollTop } from "@/components/RouteScrollTop";

const flow = readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8");
const css = readFileSync("src/styles/tesla.css", "utf8");

afterEach(() => { vi.restoreAllMocks(); document.body.removeAttribute("style"); delete document.body.dataset.scrollLocked; });

describe("scroll to top on a new stage", () => {
  it("blurs the field (closes the iOS keyboard) and glides to the top", () => {
    const input = document.createElement("input"); document.body.appendChild(input); input.focus();
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; });
    scrollPageTop();
    expect(document.activeElement).not.toBe(input);
    expect(to).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
    input.remove();
  });
  it("is instant for reduced motion and never moves the page under an open sheet", () => {
    const mm = vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: q.includes("reduce"), media: q } as MediaQueryList));
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; });
    scrollPageTop();
    expect(to).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
    mm.mockRestore();
    document.body.dataset.scrollLocked = "1"; to.mockClear();
    scrollPageTop();
    expect(to).not.toHaveBeenCalled();
  });
  it("closeKeyboard leaves buttons alone", () => {
    const b = document.createElement("button"); document.body.appendChild(b); b.focus();
    closeKeyboard();
    expect(document.activeElement).toBe(b);
    b.remove();
  });
  it("the flow goes to the top when the car and details appear, on reset and on the result", () => {
    expect(flow).toMatch(/const view = !hasCar \? "entry" : refined \? "result" : "details";/);
    expect(flow).toMatch(/function reset\(\)[\s\S]{0,1200}scrollPageTop\(\);/);
    expect(flow).toMatch(/setStage\("refined"\);\s*\/\/[^\n]*\n\s*scrollPageTop\(\{ instant: true \}\)/);
    // Keyboard closes on submit (reg card Go key, Free Valuation, Premium Report) and on the details step.
    expect(flow.match(/closeKeyboard\(\);/g)?.length).toBeGreaterThanOrEqual(2);
    // Designed glides kept: section Unlock to the Pay button / reg card, and limit notices by the buttons.
    expect(flow).toMatch(/payRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
    expect(flow).toContain('target?.scrollIntoView({ behavior: "smooth", block: "start" })');
  });
});

describe("iOS-safe body lock", () => {
  it("fixes the body at the current offset and restores the exact position", () => {
    Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const unlock = lockBodyScroll();
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-640px");
    expect(document.body.dataset.scrollLocked).toBe("1");
    unlock(); unlock();
    expect(document.body.style.position).toBe("");
    expect(document.body.dataset.scrollLocked).toBeUndefined();
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith({ top: 640, left: 0, behavior: "auto" });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});

describe("checkout sheet", () => {
  const open = () => {
    const onClose = vi.fn();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const r = render(<CheckoutSheet title="Premium Valuation Report · £2.99" label="Premium Valuation Report checkout" onClose={onClose}>{() => <div style={{ height: 3000 }}>form</div>}</CheckoutSheet>);
    return { onClose, ...r };
  };
  it("header with the X sits outside the scrolling body, and the page is locked while open", () => {
    vi.useFakeTimers();
    const { unmount } = open();
    const x = screen.getByTestId("checkout-close");
    const body = screen.getByTestId("checkout-body");
    expect(body.contains(x)).toBe(false);
    expect(body.scrollTop).toBe(0);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(document.body.style.position).toBe("fixed");
    unmount();
    expect(document.body.style.position).toBe("");
    vi.useRealTimers();
  });
  it("closes with the X, Escape and a backdrop tap (after the slide-down)", () => {
    vi.useFakeTimers();
    for (const how of ["x", "esc", "backdrop"] as const) {
      const { onClose, unmount } = open();
      if (how === "x") fireEvent.click(screen.getByTestId("checkout-close"));
      if (how === "esc") fireEvent.keyDown(window, { key: "Escape" });
      if (how === "backdrop") fireEvent.click(screen.getByTestId("checkout-sheet"));
      expect(screen.getByTestId("checkout-sheet").className).toContain("t8-co-out");
      act(() => { vi.advanceTimersByTime(300); });
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    }
    vi.useRealTimers();
  });
  it("a tap inside the sheet does not close it", () => {
    vi.useFakeTimers();
    const { onClose, unmount } = open();
    fireEvent.click(screen.getByText("form"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    vi.useRealTimers();
  });
  it("CSS: only the body scrolls, contained, and the sheet follows the visible viewport and safe area", () => {
    expect(css).toMatch(/\.t8-co-body\{[^}]*overflow-y:auto[^}]*-webkit-overflow-scrolling:touch[^}]*overscroll-behavior:contain/);
    expect(css).toMatch(/\.t8-checkout\{[^}]*height:100dvh;height:var\(--co-h,100dvh\)[^}]*env\(safe-area-inset-top\)/);
    expect(css).toMatch(/\.t8-checkout-in\{[^}]*max-height:100%[^}]*overflow:hidden/);
    expect(flow).toContain("<CheckoutSheet ");
    expect(flow).toMatch(/onClose=\{close\}\s*title=\{PREMIUM_TITLE\} hideHeader/);
  });
});

describe("route changes start at the top", () => {
  function Go({ to }: { to: string }) { const n = useNavigate(); return <button onClick={() => n(to)}>go</button>; }
  it("scrolls to the top on a new page, not on first load", () => {
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteScrollTop />
        <Routes><Route path="/" element={<Go to="/valuation/abc" />} /><Route path="/valuation/:id" element={<p>report</p>} /></Routes>
      </MemoryRouter>,
    );
    expect(to).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("report")).toBeInTheDocument();
    expect(to).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });
});
