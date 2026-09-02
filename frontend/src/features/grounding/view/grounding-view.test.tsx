import { render, screen } from "@/shared/test-utils/test-utils";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroundingView } from "./grounding-view";
import { useGroundingViewModel } from "../view-model/use-grounding-view-model";

vi.mock("../view-model/use-grounding-view-model", () => ({
  useGroundingViewModel: vi.fn(),
}));

function viewModel() {
  return {
    technique: "box-breathing" as const,
    pace: "gentle" as const,
    durationMinutes: 2,
    remainingSeconds: 120,
    totalSeconds: 120,
    isRunning: false,
    isSaving: false,
    completedSessions: 3,
    status: null,
    toggleRunning: vi.fn(),
    reset: vi.fn(),
    selectTechnique: vi.fn(),
    selectDuration: vi.fn(),
    selectPace: vi.fn(),
  };
}

describe("GroundingView", () => {
  beforeEach(() => {
    vi.mocked(useGroundingViewModel).mockReturnValue(viewModel());
  });

  it("keeps the primary session and its settings directly actionable", async () => {
    const user = userEvent.setup();
    const vm = viewModel();
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    render(<GroundingView />);

    await user.click(screen.getByRole("button", { name: /5-4-3-2-1 senses/i }));
    await user.click(screen.getByRole("button", { name: "5 min" }));
    await user.click(screen.getByRole("button", { name: /steady/i }));
    await user.click(screen.getByRole("button", { name: /begin practice/i }));

    expect(vm.selectTechnique).toHaveBeenCalledWith("5-4-3-2-1");
    expect(vm.selectDuration).toHaveBeenCalledWith(5);
    expect(vm.selectPace).toHaveBeenCalledWith("steady");
    expect(vm.toggleRunning).toHaveBeenCalledTimes(1);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<GroundingView />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
