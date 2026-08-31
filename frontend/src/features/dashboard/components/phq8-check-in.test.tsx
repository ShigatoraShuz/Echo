import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentService } from "@/services/assessment/assessment.service";
import { Phq8CheckIn } from "./phq8-check-in";

vi.mock("@/services/assessment/assessment.service", () => ({
  assessmentService: { scorePhq8: vi.fn() },
}));

describe("PHQ-8 check-in", () => {
  beforeEach(() => vi.mocked(assessmentService.scorePhq8).mockReset());

  it("submits exactly eight selected answers and shows the real response", async () => {
    vi.mocked(assessmentService.scorePhq8).mockResolvedValue({ score: 8, severity: "mild", disclaimer: "Not a diagnosis." });
    render(<Phq8CheckIn />);
    fireEvent.click(screen.getByText("Optional PHQ-8 self-check"));
    for (const radio of screen.getAllByLabelText("Several days")) fireEvent.click(radio);
    fireEvent.click(screen.getByRole("button", { name: "Calculate private result" }));
    await waitFor(() => expect(assessmentService.scorePhq8).toHaveBeenCalledWith([1, 1, 1, 1, 1, 1, 1, 1]));
    expect(await screen.findByText(/Score 8 of 24/)).toBeInTheDocument();
  });
});
