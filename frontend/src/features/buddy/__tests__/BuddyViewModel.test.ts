import { BuddyViewModel } from "../view-model/BuddyViewModel";

const mockService = {
  getConversations: jest.fn(),
  createConversation: jest.fn(),
  sendMessage: jest.fn(),
  getMessages: jest.fn(),
};

describe("BuddyViewModel", () => {
  let vm: BuddyViewModel;

  beforeEach(() => {
    jest.clearAllMocks();
    vm = new BuddyViewModel(mockService as any);
  });

  it("initializes with empty conversations", () => {
    expect(vm.conversations()).toEqual([]);
    expect(vm.isLoading()).toBe(false);
  });

  it("loads conversations on start", async () => {
    const mockData = [{ id: "1", title: "Chat", lastMessage: "Hi", updatedAt: new Date() }];
    mockService.getConversations.mockResolvedValue(mockData);
    await vm.loadConversations();
    expect(vm.conversations()).toEqual(mockData);
    expect(vm.isLoading()).toBe(false);
  });

  it("handles load error gracefully", async () => {
    mockService.getConversations.mockRejectedValue(new Error("Network error"));
    await vm.loadConversations();
    expect(vm.conversations()).toEqual([]);
    expect(vm.error()).toBe("Network error");
  });

  it("sends a message and appends to messages", async () => {
    mockService.sendMessage.mockResolvedValue({ id: "m1", role: "user", content: "Hello" });
    await vm.sendMessage("convo-1", "Hello");
    expect(mockService.sendMessage).toHaveBeenCalledWith("convo-1", "user", "Hello");
  });
});
