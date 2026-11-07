import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { scorePhq8 } from "@echo/contracts";
import { DashboardPhq8Gauge } from "./dashboard-phq8-gauge";

describe("self-reported PHQ-8 dashboard gauge", () => {
  it("does not assume a zero score when no complete answers exist", () => {
    const start = vi.fn();
    render(<DashboardPhq8Gauge onOpen={vi.fn()} onStart={start} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText("No complete check-in")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Take PHQ-8 check-in" }));
    expect(start).toHaveBeenCalledOnce();
  });
  it.each([0, 4, 5, 9, 10, 14, 15, 19, 20, 24])("uses the complete questionnaire score %i with the existing scoring thresholds", score => {
    const responses = Array.from({ length: 8 }, (_, i) => Math.min(3, Math.max(0, score - i * 3)));
    const assessment = { id: "fixture", completedAt: "2026-11-08T00:00:00Z", ...scorePhq8(responses) };
    render(<DashboardPhq8Gauge assessment={assessment} onOpen={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", String(score));
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "24");
    expect(screen.getByText(/Self-reported/)).toBeVisible();
    expect(screen.getByText(/not a diagnosis or a safety rating/)).toBeVisible();
  });
  it("keeps partial responses out of the gauge", () => {
    render(<DashboardPhq8Gauge partial due={false} onOpen={vi.fn()} onStart={vi.fn()} />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText(/Unanswered items are never scored as zero/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /new check-in/ })).not.toBeInTheDocument();
  });
});
