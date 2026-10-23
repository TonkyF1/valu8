import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportNav, REPORT_SECTIONS } from "@/components/report/ReportNav";

describe("ReportNav", () => {
  it("renders jump links for given sections", () => {
    render(<ReportNav variant="chips" sections={REPORT_SECTIONS.slice(0, 3)} active="r-price" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#r-summary", "#r-price", "#r-details"]);
  });
  it("renders nothing with fewer than two sections", () => {
    const { container } = render(<ReportNav variant="sidebar" sections={REPORT_SECTIONS.slice(0, 1)} active={null} />);
    expect(container.innerHTML).toBe("");
  });
});
