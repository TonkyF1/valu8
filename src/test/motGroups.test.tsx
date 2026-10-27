import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { groupMotByYear, motYearSummary, motYear } from "@/lib/motGroups";
import { MotHistoryByYear } from "@/components/report/MotHistoryByYear";
import type { MotEntry } from "@/lib/valuation";

const t = (date: string, result: MotEntry["result"], mileage: number, advisories: string[] = [], failures: string[] = []): MotEntry =>
  ({ date, result, mileage, advisories, failures, note: "" });

const history: MotEntry[] = [
  t("2024-03-02T10:00:00Z", "Pass", 91000, ["Tyre worn close to limit"]),
  t("2023-03-10", "Pass", 84210, ["Brake disc worn", "Oil leak"]),
  t("2023-03-01", "Fail", 84200, [], ["Headlamp aim", "Wiper blade"]),
  t("2022-02-20", "Pass", 76002),
  t("2021-02-19", "Pass", 68000, ["Corrosion"]),
  t("2020-02-18", "Pass", 60000),
  t("2019-02-17", "Pass", 52000),
  t("2018-02-16", "Pass", 44000),
  t("2017-02-15", "Pass", 36000),
];

describe("groupMotByYear", () => {
  it("groups by calendar year, newest year and newest test first", () => {
    const g = groupMotByYear([...history].reverse());
    expect(g.map(x => x.year)).toEqual([2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017]);
    expect(g[1].tests.map(m => m.result)).toEqual(["Pass", "Fail"]);
  });
  it("handles empty / missing history", () => {
    expect(groupMotByYear(undefined)).toEqual([]);
    expect(groupMotByYear([])).toEqual([]);
  });
  it("uses UTC year so a New Year's Eve/midnight date does not slip", () => {
    expect(motYear("2023-01-01T00:00:00Z")).toBe(2023);
    expect(motYear("2022-12-31")).toBe(2022);
  });
});

describe("motYearSummary", () => {
  const g = groupMotByYear(history);
  it("single test year", () => {
    expect(motYearSummary(g[2])).toBe("2022 · Pass · 76,002 miles · no advisories");
    expect(motYearSummary(g[0])).toBe("2024 · Pass · 91,000 miles · 1 advisory");
  });
  it("fail then retest pass shows count and outcomes", () => {
    expect(motYearSummary(g[1])).toBe("2023 · 2 tests: Fail, then Pass · 84,210 miles · 2 failures · 2 advisories");
  });
});

describe("<MotHistoryByYear>", () => {
  it("opens the newest year only, and toggles others accessibly", () => {
    render(<MotHistoryByYear history={history} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    buttons.slice(1).forEach(b => expect(b).toHaveAttribute("aria-expanded", "false"));
    expect(screen.getByText("Tyre worn close to limit")).toBeInTheDocument();
    expect(screen.queryByText("Brake disc worn")).not.toBeInTheDocument();

    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Brake disc worn")).toBeInTheDocument();
    expect(screen.getByText("Headlamp aim")).toBeInTheDocument();
    expect(buttons[1].getAttribute("aria-controls")).toBe("mot-year-2023");

    fireEvent.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Tyre worn close to limit")).not.toBeInTheDocument();
  });
  it("headers are native buttons (keyboard: Tab + Enter/Space)", () => {
    render(<MotHistoryByYear history={history} />);
    screen.getAllByRole("button").forEach(b => {
      expect(b.tagName).toBe("BUTTON");
      expect(b).toHaveAttribute("type", "button");
    });
  });
});
