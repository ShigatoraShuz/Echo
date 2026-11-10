import * as runtimeApi from "../../view-model/use-realtime-talk";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuddyView } from "../buddy-view";
import { useBuddyViewModel } from "@/features/buddy/view-model/use-buddy-view-model";
import type { BuddyConversation, BuddyPagination } from "@/features/buddy/model/buddy.model";

const voiceMock=vi.hoisted(()=>({start:vi.fn(),speak:vi.fn(),cancel:vi.fn()}));
vi.mock('@/features/buddy/view-model/use-buddy-voice-controls',()=>({useBuddyVoiceControls:()=>({voiceSupported:true,speechSupported:true,isListening:false,isSpeaking:false,isTranscribing:false,interimTranscript:'',voiceError:null,startListening:voiceMock.start,stopListening:()=>{},speak:voiceMock.speak,stopSpeaking:()=>{},cancel:voiceMock.cancel})}));
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

class MockRecognition {
  static instance: MockRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "en-US";
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onresult: ((event: {
    resultIndex: number;
    results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
  }) => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    MockRecognition.instance = this;
  }

  emitFinal(transcript: string) {
    this.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { isFinal: true, 0: { transcript } },
      },
    });
  }
}

vi.mock("@/features/buddy/view-model/use-buddy-view-model", () => ({
  useBuddyViewModel: vi.fn(),
}));

vi.mock("@/features/buddy/components/buddy-chat-bubble", () => ({
  BuddyChatBubble: ({ message }: { message: { content: string } }) => <div>{message.content}</div>,
}));

vi.mock("@/shared/components/ui/echo-motion-surface", () => ({
  EchoMotionSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function setupMock() {
  return {
    getTemporarySessionId:()=>"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",applyTalkMessage:vi.fn(),applyTalkDelivery:vi.fn(),
    accessStatus: "allowed" as const,
    historyEnabled: true,
    isLoadingMessages: false,
    isSending: false,
    messages: [{ id: "1", conversationId: "conv-1", content: "Hello", role: "buddy" as const, timestamp: "8:00 PM" }],
    activeConversationId: "conv-1" as string | null,
    error: null as string | null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    loadConversations: vi.fn(),
    selectConversation: vi.fn(),
    clearConversation: vi.fn(),
    createConversation: vi.fn(),
    renameConversation: vi.fn(),
    pinConversation: vi.fn(),
    deleteConversation: vi.fn(),
    retryMessage: vi.fn(),
    sendFeedback: vi.fn(),
    conversations: [] as BuddyConversation[],
    searchConversations: vi.fn(),
    isLoadingList: false,
    selectedConversation: null,
    searchQuery: "",
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } as BuddyPagination,
    isStreaming: false,
    streamingContent: "",
  };
}

describe("BuddyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockRecognition.instance = null;
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/buddy");
  });

  it("makes overflowing conversation text reachable with the keyboard", () => {
    vi.mocked(useBuddyViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
    render(<BuddyView />);
    expect(screen.getByRole("log", { name: "Conversation messages" })).toHaveAttribute("tabindex", "0");
  });

  it("reopens a previous chat and keeps its URL for reload and browser back", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.conversations = [
      { id: "conv-1", title: "First chat", pinnedAt: null } as BuddyConversation,
      { id: "conv-2", title: "Earlier chat", pinnedAt: null } as BuddyConversation,
    ];
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);
    await user.click(screen.getByText("Earlier chat").closest("button")!);
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-2");
    expect(window.location.search).toBe("?conversation=conv-2");

    window.history.pushState(null, "", "/buddy?conversation=conv-1");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-1");
  });

  it("opens saved chats and starts a separate chat from the phone history panel", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.conversations = [
      { id: "conv-1", title: "Current chat", pinnedAt: null } as BuddyConversation,
      { id: "conv-2", title: "Earlier chat", pinnedAt: null } as BuddyConversation,
    ];
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);
    await user.click(screen.getByRole("button", { name: "Open conversation history" }));
    const panel = within(screen.getByRole("dialog", { name: "Your conversations" }));
    await user.click(panel.getByText("Earlier chat").closest("button")!);
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-2");
    expect(window.location.search).toBe("?conversation=conv-2");

    await user.click(screen.getByRole("button", { name: "Open conversation history" }));
    await user.click(within(screen.getByRole("dialog", { name: "Your conversations" })).getByRole("button", { name: "New conversation" }));
    expect(mock.createConversation).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("");
  });

  it("loads a linked older chat and sends the next message to that chat", async () => {
    window.history.replaceState(null, "", "/buddy?conversation=conv-2");
    const mock = setupMock();
    mock.activeConversationId = null;
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    const { rerender } = render(<BuddyView />);
    expect(mock.selectConversation).toHaveBeenCalledWith("conv-2");

    mock.activeConversationId = "conv-2";
    mock.messages = [{ id: "old-reply", conversationId: "conv-2", content: "An earlier reply", role: "buddy", timestamp: "8:00 PM" }];
    rerender(<BuddyView />);
    await userEvent.setup().type(screen.getByLabelText(/message buddy/i), "Following up");
    await userEvent.setup().click(screen.getByRole("button", { name: /send message/i }));
    expect(mock.sendMessage).toHaveBeenCalledWith("conv-2", "Following up");
    expect(screen.getByText("An earlier reply")).toBeInTheDocument();
  });

  it("supports prompt chips, typing, and sending", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);

    await user.click(screen.getByRole("button", { name: "Show prompt ideas" }));
    await user.click(screen.getByRole("button", { name: /reflect on today/i }));
    await user.type(screen.getByLabelText(/message buddy/i), "I need a calmer plan");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(mock.sendMessage).toHaveBeenCalledWith("conv-1", expect.any(String));
  });

  it('defaults to Chat and switches to Talk without changing conversation',async()=>{const user=userEvent.setup();const mock=setupMock();vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);render(<BuddyView/>);expect(screen.getByRole('button',{name:'Chat'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:/start voice input/i})).toBeDisabled();await user.click(screen.getByRole('button',{name:'Talk'}));expect(screen.getByRole('button',{name:/start voice input/i})).toBeEnabled();expect(voiceMock.cancel).toHaveBeenCalled();expect(mock.selectConversation).not.toHaveBeenCalled();});
  it('sends a stopped Talk transcript using the current conversation',async()=>{const user=userEvent.setup();const mock=setupMock();vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);voiceMock.start.mockImplementation((callback:(text:string)=>void)=>callback('Synthetic voice input'));render(<BuddyView/>);await user.click(screen.getByRole('button',{name:'Talk'}));await user.click(screen.getByRole('button',{name:/start voice input/i}));expect(mock.sendMessage).toHaveBeenCalledWith('conv-1','Synthetic voice input');});
  it('requests local playback of the latest approved reply',async()=>{const user=userEvent.setup();const mock=setupMock();vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);render(<BuddyView/>);await user.click(screen.getByRole('button',{name:/speak latest buddy reply/i}));expect(voiceMock.speak).toHaveBeenCalled();});
  it("hides pin actions without the pin migration and offers history retry", async () => {
    const user = userEvent.setup();
    const base = setupMock();
    const mock = {
      ...base,
      activeConversationId: null,
      error: "Buddy history could not be loaded.",
      pagination: { ...base.pagination, pinsAvailable: false },
      conversations: [{ id: "conv-1", title: "Evening", pinnedAt: null, lastMessageAt: "Today" }] as BuddyConversation[],
    };
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);

    render(<BuddyView />);
    expect(screen.queryByText("Pinned chats")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin Evening" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry history" }));
    expect(mock.loadConversations).toHaveBeenCalled();
  });

  it("preserves the draft when sending fails", async () => {
    const user = userEvent.setup();
    const mock = setupMock();
    mock.sendMessage.mockResolvedValue(false);
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    render(<BuddyView />);
    await user.type(screen.getByLabelText(/message buddy/i), "Please stay with me");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(screen.getByLabelText(/message buddy/i)).toHaveValue("Please stay with me");
  });
});

it("announces generation without malformed loading text", () => {
  const mock=setupMock();
  mock.isSending=true;
  vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
  render(<BuddyView />);
  expect(screen.getAllByRole("status").some(el=>el.textContent?.includes("Buddy is reflecting"))).toBe(true);
  expect(screen.queryByText(/â/)).not.toBeInTheDocument();
});

it('releases only the page lease belonging to the unmounted Buddy tab',async()=>{
 const a={id:'40000000-0000-4000-8000-000000000001',profile:'buddy_chat' as const,expiresAt:'2026-11-04T12:00:00.000Z',state:'ready' as const};
 const b={...a,id:'40000000-0000-4000-8000-000000000002'};
 const acquire=vi.spyOn(runtimeApi,'acquireBuddyLease').mockResolvedValueOnce(a).mockResolvedValueOnce(b);
 const release=vi.spyOn(runtimeApi,'releaseBuddyLease').mockResolvedValue({released:true});
 const mock=setupMock();vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
 const first=render(<BuddyView/>),second=render(<BuddyView/>);
 try{
  await waitFor(()=>expect(acquire).toHaveBeenCalledTimes(2));await act(async()=>{});
  first.unmount();await waitFor(()=>expect(release).toHaveBeenCalledWith(a.id));
  expect(release).not.toHaveBeenCalledWith(b.id);
  second.unmount();await waitFor(()=>expect(release).toHaveBeenCalledWith(b.id));
 }finally{first.unmount();second.unmount();acquire.mockRestore();release.mockRestore();}
});

it('releases a lease that finishes acquiring after its page has exited',async()=>{
 const lease={id:'40000000-0000-4000-8000-000000000003',profile:'buddy_chat' as const,expiresAt:'2026-11-04T12:00:00.000Z',state:'preparing' as const};
 let resolve!:(value:typeof lease)=>void;
 const acquire=vi.spyOn(runtimeApi,'acquireBuddyLease').mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const release=vi.spyOn(runtimeApi,'releaseBuddyLease').mockResolvedValue({released:true});
 const mock=setupMock();vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
 const view=render(<BuddyView/>);
 try{await waitFor(()=>expect(acquire).toHaveBeenCalled());view.unmount();await act(async()=>{resolve(lease);});expect(release).toHaveBeenCalledWith(lease.id);}
 finally{view.unmount();acquire.mockRestore();release.mockRestore();}
});

it('shows safe component progress only when opening the Send-adjacent icon',async()=>{
 const acquire=vi.spyOn(runtimeApi,'acquireBuddyLease').mockResolvedValue({id:'lease',profile:'buddy_chat',expiresAt:new Date().toISOString(),state:'preparing',preparation:{component:'cbt',state:'retrying',attempt:2,maxAttempts:5,elapsedSeconds:18,retryInSeconds:5,correlationId:'a'.repeat(32)}});
 const release=vi.spyOn(runtimeApi,'releaseBuddyLease').mockResolvedValue({released:true});
 vi.mocked(useBuddyViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);
 const page=render(<BuddyView/>);
 try{
  await waitFor(()=>expect(acquire).toHaveBeenCalled());
  expect(screen.queryByText(/Attempt 2 of 5/)).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button',{name:'Model loading details'}));
  expect(screen.getByText(/Buddy response model: retrying. Attempt 2 of 5/)).toBeVisible();
  expect(screen.getByText('Retrying in 5 seconds.')).toBeVisible();
 }finally{page.unmount();acquire.mockRestore();release.mockRestore();}
});

it('keeps the loading icon active when Whisper is ready but Nano is still preparing',async()=>{
 const acquire=vi.spyOn(runtimeApi,'acquireBuddyLease').mockResolvedValue({id:'lease',profile:'buddy_chat',expiresAt:new Date().toISOString(),state:'ready',preparation:{component:'whisper',state:'ready',attempt:1,maxAttempts:5,loadingComponents:['nano']}});
 const release=vi.spyOn(runtimeApi,'releaseBuddyLease').mockResolvedValue({released:true});
 vi.mocked(useBuddyViewModel).mockReturnValue(setupMock() as ReturnType<typeof setupMock>);const page=render(<BuddyView/>);
 try{
  await waitFor(()=>expect(acquire).toHaveBeenCalled());expect(screen.getByRole('status',{name:'Buddy models: preparing'})).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button',{name:'Model loading details'}));expect(screen.getByText('Preparing: Speech model and voice.')).toBeVisible();
 }finally{page.unmount();acquire.mockRestore();release.mockRestore();}
});

it('keeps typed text and shows loading status when Send is waiting for local models',async()=>{
 const acquire=vi.spyOn(runtimeApi,'acquireBuddyLease').mockResolvedValue({id:'lease',profile:'buddy_chat',expiresAt:new Date().toISOString(),state:'preparing'});
 const release=vi.spyOn(runtimeApi,'releaseBuddyLease').mockResolvedValue({released:true});
 const mock={...setupMock(),loadingNotice:'Buddy is still loading its local models. Your message has not been sent.'};mock.sendMessage.mockResolvedValue(false);
 vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);const page=render(<BuddyView/>);
 try{
  await userEvent.setup().type(screen.getByLabelText(/message buddy/i),'Keep this text');await userEvent.setup().click(screen.getByRole('button',{name:'Send message'}));
  await waitFor(()=>expect(screen.getByLabelText(/message buddy/i)).toHaveValue('Keep this text'));
  expect(screen.getByText(mock.loadingNotice)).toHaveAttribute('role','status');expect(screen.queryByText('Something went wrong on our end. Please try again later.')).not.toBeInTheDocument();
 }finally{page.unmount();acquire.mockRestore();release.mockRestore();}
});
it("opens the public Buddy shell without exposing messages or the composer during access checks", () => {
  vi.mocked(useBuddyViewModel).mockReturnValue({ ...setupMock(), accessStatus: "loading" } as unknown as ReturnType<typeof useBuddyViewModel>);
  render(<BuddyView />);
  expect(screen.getByRole("heading", { name: /^Buddy$/ })).toBeInTheDocument();
  expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Message Buddy" })).not.toBeInTheDocument();
});

describe("clean recent chats", () => {
  function recentMock() {
    const mock = setupMock();
    mock.conversations = Array.from({ length: 10 }, (_, index) => ({ id: `recent-${index}`, title: `Reflection ${index + 1}`, lastMessage: `Private preview ${index}`, lastMessageAt: "Nov 8", messageCount: 2, mood: "neutral", createdAt: "2026-11-08T00:00:00Z", pinnedAt: null } as BuddyConversation));
    return mock;
  }
  it("keeps the initial list compact without deleting chats and expands all loaded recent chats", async () => {
    const mock = recentMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    render(<BuddyView />);
    expect(screen.getByText("Reflection 8")).toBeVisible();
    expect(screen.queryByText("Reflection 9")).not.toBeInTheDocument();
    expect(screen.queryByText("Private preview 0")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show 2 more chats" }));
    expect(screen.getByText("Reflection 10")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show fewer chats" }));
    expect(screen.queryByText("Reflection 9")).not.toBeInTheDocument();
    expect(mock.deleteConversation).not.toHaveBeenCalled();
  });
  it("filters the loaded history instantly, including hidden chats, without requesting another page", async () => {
    const mock = recentMock();
    vi.mocked(useBuddyViewModel).mockReturnValue(mock as ReturnType<typeof setupMock>);
    render(<BuddyView />);
    const input = screen.getByRole("searchbox", { name: "Filter recent chats" });
    await userEvent.setup().type(input, "Reflection 10");
    expect(screen.getByText("Reflection 10")).toBeVisible();
    expect(screen.queryByText("Reflection 1")).not.toBeInTheDocument();
    expect(mock.loadConversations).not.toHaveBeenCalled();
    await userEvent.setup().clear(input);
    expect(screen.getByText("Reflection 1")).toBeVisible();
    expect(screen.queryByText("Reflection 10")).not.toBeInTheDocument();
  });
});
