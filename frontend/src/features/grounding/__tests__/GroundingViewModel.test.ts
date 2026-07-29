import { GroundingViewModel } from "../view-model/GroundingViewModel";

const mockService = {
  recordSession: jest.fn(),
  getHistory: jest.fn(),
};

describe("GroundingViewModel", () => {
  let vm: GroundingViewModel;

  beforeEach(() => {
    jest.clearAllMocks();
    vm = new GroundingViewModel(mockService as any);
  });

  it("initializes with empty history", () => {
    expect(vm.history()).toEqual([]);
    expect(vm.isActive()).toBe(false);
  });

  it("loads session history", async () => {
    const mockHistory = [{ id: "1", exerciseType: "box_breathing", durationSeconds: 120, createdAt: new Date() }];
    mockService.getHistory.mockResolvedValue(mockHistory);
    await vm.loadHistory();
    expect(vm.history()).toEqual(mockHistory);
  });

  it("records a session", async () => {
    mockService.recordSession.mockResolvedValue({ id: "s1", exerciseType: "sensory", durationSeconds: 60 });
    const result = await vm.completeSession("sensory", 60);
    expect(mockService.recordSession).toHaveBeenCalledWith("sensory", 60);
    expect(result?.id).toBe("s1");
  });

  it("tracks active state during session", () => {
    expect(vm.isActive()).toBe(false);
    vm.startSession();
    expect(vm.isActive()).toBe(true);
    vm.endSession();
    expect(vm.isActive()).toBe(false);
  });

  it("handles load error gracefully", async () => {
    mockService.getHistory.mockRejectedValue(new Error("Offline"));
    await vm.loadHistory();
    expect(vm.error()).toBe("Offline");
  });
});
