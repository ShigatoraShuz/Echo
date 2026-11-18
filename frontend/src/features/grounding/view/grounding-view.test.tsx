import { render, screen } from "@/shared/test-utils/test-utils";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroundingView } from "./grounding-view";
import { useGroundingViewModel } from "../view-model/use-grounding-view-model";
import type { GroundingSession } from "../model/grounding.model";

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
    saveError: false,
    completedSessions: 3,
    history: [] as GroundingSession[],
    historyError: null,
    status: null,
    toggleRunning: vi.fn(),
    reset: vi.fn(),
    selectTechnique: vi.fn(),
    selectDuration: vi.fn(),
    selectPace: vi.fn(),
    startPractice: vi.fn(),
    retrySave: vi.fn(),
    reloadHistory: vi.fn(),
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

    await user.click(screen.getByRole("button", { name: "Start 5-4-3-2-1 grounding" }));
    expect(vm.startPractice).toHaveBeenCalledWith("sensory-5-4-3-2-1", 5);
    await user.click(screen.getByRole("button", { name: /Continue/i }));
    expect(vm.toggleRunning).toHaveBeenCalledTimes(1);
  });

  it("offers only the two supported exercises without search or filters", () => {
    render(<GroundingView />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start Box breathing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start 5-4-3-2-1 grounding" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter grounding practices" })).not.toBeInTheDocument();
    expect(screen.queryByText("Browse grounding exercises")).not.toBeInTheDocument();
  });

  it("shows saved weekly progress rather than a sample count", () => {
    const vm = viewModel();
    vm.history = [{ id: "one", type: "box-breathing", duration: 120, pace: "slow", completedAt: new Date().toISOString(), progress: 100, state: "completed" }];
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    render(<GroundingView />);
    expect(screen.getByText("1 / 7")).toBeInTheDocument();
  });

  it("counts started practices once per local day", () => {
    const vm = viewModel();
    vm.history = ["one", "two"].map((id) => ({ id, type: "box-breathing", duration: 120, pace: "slow", startedAt: new Date().toISOString(), completedAt: null, progress: 0, state: "running" }));
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    render(<GroundingView />);
    expect(screen.getByText("1 / 7")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<GroundingView />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps sensory steps, reset, and browse usable in the session", async () => {
    const user = userEvent.setup();
    const vm = viewModel();
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    const { container } = render(<GroundingView />);
    await user.click(screen.getByRole("button", { name: "Start 5-4-3-2-1 grounding" }));
    await user.click(screen.getByRole("button", { name: /Next sense/i }));
    expect(screen.getByText("Notice four things you can feel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(vm.reset).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: /Browse/i }));
    expect(screen.getByRole("heading", { name: "A gentle place to begin" })).toBeInTheDocument();
  });

  it("offers recovery for a failed history request", async () => {
    const user = userEvent.setup();
    const vm = { ...viewModel(), historyError: "History unavailable" };
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    render(<GroundingView />);
    expect(screen.getByRole("alert")).toHaveTextContent("History unavailable");
    await user.click(screen.getByRole("button", { name: "Retry loading history" }));
    expect(vm.reloadHistory).toHaveBeenCalledOnce();
  });

  it("offers a safe retry after an uncertain session save", async () => {
    const user = userEvent.setup();
    const vm = { ...viewModel(), saveError: true };
    vi.mocked(useGroundingViewModel).mockReturnValue(vm);
    render(<GroundingView />);
    await user.click(screen.getByRole("button", { name: "Start 5-4-3-2-1 grounding" }));
    await user.click(screen.getByRole("button", { name: "Retry saving" }));
    expect(vm.retrySave).toHaveBeenCalledOnce();
  });
});
