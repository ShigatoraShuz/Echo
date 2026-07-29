import { OnboardingViewModel } from "../view-model/OnboardingViewModel";

const mockService = {
  saveConsent: jest.fn(),
  saveProfile: jest.fn(),
  completeOnboarding: jest.fn(),
};

describe("OnboardingViewModel", () => {
  let vm: OnboardingViewModel;

  beforeEach(() => {
    jest.clearAllMocks();
    vm = new OnboardingViewModel(mockService as any);
  });

  it("starts at first step", () => {
    expect(vm.currentStep()).toBe(0);
    expect(vm.totalSteps()).toBe(5);
  });

  it("advances through steps", () => {
    vm.nextStep();
    expect(vm.currentStep()).toBe(1);
    vm.nextStep();
    expect(vm.currentStep()).toBe(2);
  });

  it("does not go below step 0", () => {
    vm.previousStep();
    expect(vm.currentStep()).toBe(0);
  });

  it("does not exceed total steps", () => {
    for (let i = 0; i < 10; i++) vm.nextStep();
    expect(vm.currentStep()).toBe(4);
  });

  it("saves consent and advances", async () => {
    mockService.saveConsent.mockResolvedValue({});
    const consents = { terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: false };
    await vm.submitConsent(consents);
    expect(mockService.saveConsent).toHaveBeenCalledWith(consents);
    expect(vm.currentStep()).toBe(1);
  });

  it("completes onboarding and sets done", async () => {
    mockService.completeOnboarding.mockResolvedValue({});
    await vm.finish();
    expect(mockService.completeOnboarding).toHaveBeenCalled();
    expect(vm.isComplete()).toBe(true);
  });

  it("handles error during consent submission", async () => {
    mockService.saveConsent.mockRejectedValue(new Error("Server error"));
    await vm.submitConsent({ terms: true, privacy: true, dataProcessing: true, aiInformation: true, journalAnalysis: true });
    expect(vm.error()).toBe("Server error");
  });
});
