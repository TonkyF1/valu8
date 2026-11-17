import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { HOME_EVENT, depthOf, popAction, pushFor, readFlowSnapshot, saveFlowSnapshot, viewOf } from "@/lib/flowHistory";
import { HomeLink } from "@/components/HomeLink";
import { StartGate, shouldUseOldForm } from "@/components/StartGate";
import { RouteScrollTop } from "@/components/RouteScrollTop";

const flow = readFileSync("src/components/tesla/TeslaFlow.tsx", "utf8");
const layout = readFileSync("src/components/Layout.tsx", "utf8");
const footer = readFileSync("src/components/Footer.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }

describe("flow history steps", () => {
  it("pushes one entry per forward step and never for the same or an earlier step", () => {
    expect(pushFor(null, "details")).toEqual({ v8: "details", v8d: 1 });
    expect(pushFor({ v8: "details", v8d: 1 }, "result")).toEqual({ v8: "result", v8d: 2 });
    expect(pushFor({ v8: "result", v8d: 2 }, "checkout")).toEqual({ v8: "checkout", v8d: 3 });
    expect(pushFor({ v8: "details", v8d: 1 }, "checkout")).toEqual({ v8: "checkout", v8d: 2 });
    expect(pushFor({ v8: "details", v8d: 1 }, "details")).toBeNull();
    expect(pushFor({ v8: "result", v8d: 2 }, "details")).toBeNull();
    expect(pushFor({ v8: "checkout", v8d: 3 }, "entry")).toBeNull();
    expect(pushFor({ key: "x" }, "entry")).toBeNull();
  });
  it("reads the step and depth defensively", () => {
    expect(viewOf(undefined)).toBe("entry");
    expect(viewOf({ v8: "nonsense" })).toBe("entry");
    expect(viewOf({ v8: "result" })).toBe("result");
    expect(depthOf({ v8d: "2" })).toBe(2);
    expect(depthOf({ v8d: -1 })).toBe(0);
    expect(depthOf(null)).toBe(0);
  });
  it("Back closes the checkout, then result to details, then details to the landing card", () => {
    const ctx = { hasLookup: true, hasResult: true, canCheckout: true };
    expect(popAction("result", { ...ctx, view: "checkout" })).toEqual({ kind: "closeCheckout" });
    expect(popAction("details", { ...ctx, view: "checkout" })).toEqual({ kind: "show", view: "details", closeCheckout: true });
    expect(popAction("details", { ...ctx, view: "result" })).toEqual({ kind: "show", view: "details", closeCheckout: false });
    expect(popAction("entry", { ...ctx, view: "details" })).toEqual({ kind: "show", view: "entry", closeCheckout: false });
    expect(popAction("entry", { ...ctx, view: "entry" })).toEqual({ kind: "none" });
  });
  it("Forward reopens what still exists and rewrites entries that can't be shown", () => {
    expect(popAction("details", { view: "entry", hasLookup: true, hasResult: false, canCheckout: false })).toEqual({ kind: "show", view: "details", closeCheckout: false });
    expect(popAction("result", { view: "details", hasLookup: true, hasResult: true, canCheckout: true })).toEqual({ kind: "show", view: "result", closeCheckout: false });
    expect(popAction("checkout", { view: "result", hasLookup: true, hasResult: true, canCheckout: true })).toEqual({ kind: "openCheckout" });
    expect(popAction("checkout", { view: "entry", hasLookup: false, hasResult: false, canCheckout: false })).toEqual({ kind: "replace", view: "entry" });
    expect(popAction("details", { view: "entry", hasLookup: false, hasResult: false, canCheckout: false })).toEqual({ kind: "replace", view: "entry" });
    expect(popAction("result", { view: "details", hasLookup: true, hasResult: false, canCheckout: false })).toEqual({ kind: "replace", view: "details" });
  });
  it("keeps a recent snapshot for this tab only", () => {
    saveFlowSnapshot({ reg: "AB12CDE", lookup: { registration: "AB12CDE" } });
    expect(readFlowSnapshot<any>()?.reg).toBe("AB12CDE");
    expect(readFlowSnapshot(0)).toBeNull();
    saveFlowSnapshot(null);
    expect(readFlowSnapshot()).toBeNull();
  });
});

describe("history integration in the home flow", () => {
  it("pushes on forward steps, applies Back on POP, and unwinds on reset", () => {
    expect(flow).toMatch(/const flowView: FlowView = checkoutOpen && valuationId \? "checkout" : view;/);
    expect(flow).toMatch(/pushFor\(locRef\.current\.state, flowView\)[\s\S]{0,80}navigate\(here\(\), \{ state: st \}\)/);
    expect(flow).toMatch(/if \(navType === "POP"\) applyHistory\(viewOf\(location\.state\)\)/);
    expect(flow).toMatch(/function reset\(\)[\s\S]{0,900}if \(d > 0\) navigate\(-d\);/);
    // The X, backdrop and swipe drop the checkout entry; paying replaces it with the report.
    expect(flow).toMatch(/if \(viewOf\(locRef\.current\.state\) === "checkout"\) navigate\(-1\);/);
    expect(flow).toContain('{ replace: viewOf(locRef.current.state) === "checkout" }');
    // Back scrolls to the top, and in-flight lookups can't pull the flow forward again.
    expect(flow).toMatch(/function applyHistory[\s\S]{0,1600}scrollPageTop\(\);/);
    expect(flow.match(/epoch\.current !== e0|!live\(\)/g)?.length).toBeGreaterThanOrEqual(6);
  });
  it("shows an on-screen Back on the car and result steps, not on the landing card", () => {
    expect(flow).toMatch(/\{hasCar && \(\s*<button type="button" className="t8-back" data-testid="flow-back" onClick=\{goBack\}/);
    expect(flow).toMatch(/function goBack\(\) \{\s*if \(depthOf\(locRef\.current\.state\) > 0\) navigate\(-1\);/);
  });
  it("restores the step from the snapshot when coming back from the report page", () => {
    expect(flow).toMatch(/const snap = readFlowSnapshot<any>\(\);/);
    expect(flow).toMatch(/saveFlowSnapshot\(\{ reg, lookup,/);
  });
});

describe("Valu8 logo and Value a car go to the new start", () => {
  it("every header and footer logo uses HomeLink to /, also when signed in", () => {
    expect(layout).not.toMatch(/to=\{user \? "\/dashboard" : "\/"\}/);
    expect(layout).toMatch(/<HomeLink className="flex items-center shrink-0" aria-label="Valu8 home"/);
    expect(layout).not.toMatch(/to(=|: )"\/valuation\/new"/);
    expect(footer).toMatch(/<HomeLink aria-label="Valu8 home"[^>]*><Logo size="sm" \/><\/HomeLink>/);
    expect(footer).not.toMatch(/to(=|: )"\/valuation\/new"/);
  });
  it("from another page the logo opens the homepage", () => {
    render(
      <MemoryRouter initialEntries={["/value/ford-fiesta"]}>
        <Routes><Route path="*" element={<><HomeLink aria-label="Valu8 home">logo</HomeLink><Where /></>} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Valu8 home"));
    expect(screen.getByTestId("where").textContent).toBe("/");
  });
  it("on the homepage the logo resets the flow instead of doing nothing", () => {
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(HOME_EVENT, on);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes><Route path="*" element={<><HomeLink aria-label="Valu8 home">logo</HomeLink><HomeLink focusReg>Value a car</HomeLink><Where /></>} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Valu8 home"));
    fireEvent.click(screen.getByText("Value a car"));
    window.removeEventListener(HOME_EVENT, on);
    expect(seen).toEqual([{ focusReg: false }, { focusReg: true }]);
    expect(screen.getByTestId("where").textContent).toBe("/");
  });
  it("the flow listens for the logo and resets", () => {
    expect(flow).toMatch(/window\.addEventListener\(HOME_EVENT, home\)/);
  });
});

describe("old /valuation/new start", () => {
  it("plain visits go to the homepage flow, keeping reg and utm", () => {
    expect(app).toContain("<StartGate><NewValuation /></StartGate>");
    render(
      <MemoryRouter initialEntries={["/valuation/new?reg=AB12CDE&utm_source=embed"]}>
        <Routes>
          <Route path="/valuation/new" element={<StartGate><p>old form</p></StartGate>} />
          <Route path="/" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("old form")).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe("/?reg=AB12CDE&utm_source=embed");
  });
  it("the older form stays for typing details by hand and for a valuation started before sign-in", () => {
    expect(shouldUseOldForm("?manual=1", false)).toBe(true);
    expect(shouldUseOldForm("", true)).toBe(true);
    expect(shouldUseOldForm("?reg=AB12CDE", false)).toBe(false);
    expect(flow).toContain('to="/valuation/new?manual=1">Enter details by hand');
  });
});

describe("route scroll ignores the flow's own steps", () => {
  it("a same-page history step does not jump the page", () => {
    const to = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    function Step() { const n = useNavigate(); return <button onClick={() => n("/", { state: { v8: "details", v8d: 1 } })}>step</button>; }
    render(<MemoryRouter initialEntries={["/"]}><RouteScrollTop /><Routes><Route path="/" element={<Step />} /></Routes></MemoryRouter>);
    act(() => { fireEvent.click(screen.getByText("step")); });
    expect(to).not.toHaveBeenCalled();
  });
});
