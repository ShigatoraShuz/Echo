import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, it } from "vitest";
import { AnalysisHistory } from "./analysis-history";
import type { DashboardInsights } from "@echo/contracts";
const overview: DashboardInsights = { latest: null, recommendation: null, emotionTrend: [], distressTrend: [] };
it("shows no invented points or zero score for empty history", () => {
  render(<AnalysisHistory insights={overview} />);
  expect(screen.getByText("No analysis data yet for this period.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("orders dates, separates model identities, and leaves missing scores unavailable", async () => {
  render(<AnalysisHistory insights={{ ...overview, emotionTrend: [
    { date: "2026-10-31", values: { joy: 0.5 }, modelIdentity: "fictional-A", isSimulated: false },
    { date: "2026-10-01", values: { fear: 0.8 }, modelIdentity: "fictional-A", isSimulated: false },
    { date: "2026-10-15", values: { joy: 0.9 }, modelIdentity: "fictional-B", isSimulated: false },
    { date: "2026-10-14", values: { joy: 0.1 }, modelIdentity: "synthetic-excluded", isSimulated: true },
  ] }} />);
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  expect(screen.getAllByText("2026-10-01")[0]).toBeInTheDocument();
  expect(screen.queryByText(/synthetic-excluded/)).not.toBeInTheDocument();
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
  await userEvent.setup().selectOptions(screen.getAllByRole("combobox")[0], "joy");
  expect(screen.getByText("50.0%")).toBeInTheDocument();
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
});
it("never displays a total for partial or unavailable screening and passes accessibility checks", async () => {
  const { container } = render(<AnalysisHistory insights={{ ...overview, journalScreeningTrend: [
    { date: "2026-10-31", status: "available", coverage: 1, subtotal: 0, total: null },
    { date: "2026-10-30", status: "unavailable", coverage: 0, subtotal: null, total: null },
  ] }} />);
  expect(screen.getByText("Partial subtotal 0 (1/8 criteria)")).toBeInTheDocument();
  expect(screen.queryByText(/Model total/)).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});


it("links separate reports saved on the same day", () => {
  const reports = [1, 2].map(id => ({
    resultId: `00000000-0000-4000-8000-00000000000${id}`,
    journalId: `00000000-0000-4000-8000-00000000001${id}`,
    analyzedAt: `2026-10-31T0${id}:00:00Z`,
  }));
  render(<AnalysisHistory insights={{ ...overview, savedReports: reports }} />);
  expect(screen.getAllByRole("link", { name: "Open journal report" }).map(link => link.getAttribute("href")))
    .toEqual(reports.map(report => `/journal/${report.journalId}`));
});
