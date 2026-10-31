import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarView } from "./calendar-view";

const mocks = vi.hoisted(() => ({
  listItems: vi.fn(),
  createItem: vi.fn(),
  listEntries: vi.fn(),
  getAnalysis: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  listAppointments: vi.fn(),
}));

vi.mock("@/services/calendar/calendar-api", () => ({
  calendarApi: { list: mocks.listItems, create: mocks.createItem, update: mocks.updateItem, remove: mocks.removeItem },
}));
vi.mock("@/services/journal/journal-service.factory", () => ({
  getJournalService: () => ({ listEntries: mocks.listEntries, getAnalysis: mocks.getAnalysis }),
}));
vi.mock("@/services/professionals/professional-api", () => ({
  professionalApi: { appointments: mocks.listAppointments },
}));

describe("CalendarView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAppointments.mockResolvedValue({ appointments: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it("saves a dated item in the calendar without implying a timed notification", async () => {
    mocks.listItems.mockResolvedValue([]);
    mocks.listEntries.mockResolvedValue({ success: true, data: { entries: [], pagination: { totalPages: 1 } } });
    mocks.createItem.mockImplementation(async (input) => ({ ...input, id: "item-1", completedAt: null }));
    const user = userEvent.setup();
    render(<CalendarView />);

    await waitFor(() => expect(screen.getByText(/0 reflections · 0 saved items/)).toBeInTheDocument());
    await user.type(screen.getByLabelText("Add to this day"), "Review tomorrow's journal");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Review tomorrow's journal")).toBeInTheDocument();
    expect(mocks.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "reminder", content: "Review tomorrow's journal" }),
    );
    expect(screen.getByText(/No timed notification is sent/)).toBeInTheDocument();
  });

  it("shows completed analysis and lets the owner finish and remove a saved reminder", async () => {
    const today = new Date();
    const selectedDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const item = { id: "item-1", scheduledOn: selectedDay, scheduledTime: null, kind: "reminder", content: "Take a walk", completedAt: null };
    mocks.listItems.mockResolvedValue([item]);
    mocks.listEntries.mockResolvedValue({ success: true, data: { entries: [{ id: "journal-1", title: "A quiet page", body: "Today felt calm", excerpt: "Today felt calm", mood: "calm", createdAt: today.toISOString(), analysisConsent: true }], pagination: { totalPages: 1 } } });
    mocks.getAnalysis.mockResolvedValue({ success: true, data: { id: "analysis-1", isDemoData: false, summary: "A steadier day", result: { recommendationFeatures: ["slower_breath"] } } });
    mocks.updateItem.mockResolvedValue({ ...item, completedAt: today.toISOString() });
    mocks.removeItem.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<CalendarView />);

    expect(await screen.findByText("A steadier day")).toBeInTheDocument();
    expect(screen.getByText(/Suggested next steps: slower breath/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByRole("button", { name: "Mark incomplete" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete reminder" }));
    await waitFor(() => expect(screen.queryByText("Take a walk")).not.toBeInTheDocument());
    expect(mocks.removeItem).toHaveBeenCalledWith("item-1");
  });

  it("keeps reflections visible when saved calendar items fail to load and allows retry", async () => {
    mocks.listItems.mockRejectedValueOnce(new Error("Calendar items could not be loaded.")).mockResolvedValue([]);
    mocks.listEntries.mockResolvedValue({
      success: true,
      data: { entries: [{ id: "journal-1", title: "A quiet page", body: "Today felt calm", excerpt: "Today felt calm", mood: "calm", createdAt: new Date().toISOString(), analysisConsent: false }], pagination: { totalPages: 1 } },
    });
    const user = userEvent.setup();
    render(<CalendarView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something unexpected happened.");
    expect(screen.getByRole("link", { name: "A quiet page" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.listItems).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows an analysis load failure instead of checking forever", async () => {
    mocks.listItems.mockResolvedValue([]);
    mocks.listEntries.mockResolvedValue({
      success: true,
      data: { entries: [{
        id: "journal-1", title: "A quiet page", body: "Today felt calm", excerpt: "Today felt calm",
        mood: "calm", createdAt: new Date().toISOString(), analysisConsent: true,
      }], pagination: { totalPages: 1 } },
    });
    mocks.getAnalysis.mockRejectedValue(new Error("offline"));

    render(<CalendarView />);

    expect(await screen.findByRole("link", { name: "A quiet page" })).toBeInTheDocument();
    expect(await screen.findByText(/Analysis could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText(/Checking for completed analysis/)).not.toBeInTheDocument();
  });

  it.each(["proposed", "confirmed"])("shows a %s appointment on its local calendar day and links to its controls", async (status) => {
    const today = new Date();
    const startsAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15).toISOString();
    mocks.listItems.mockResolvedValue([]);
    mocks.listEntries.mockResolvedValue({ success: true, data: { entries: [], pagination: { totalPages: 1 } } });
    mocks.listAppointments.mockResolvedValue({ appointments: [{
      id: "appointment-1", requestId: "request-1", startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
      mode: "online", locationHint: "Private video room", status,
    }] });
    render(<CalendarView />);

    expect(await screen.findByText("Private video room")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View appointment" })).toHaveAttribute("href", "/professional-support/appointments");
    expect(screen.getByText(/0 reflections · 0 saved items · 1 appointment$/)).toBeInTheDocument();
    expect(mocks.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.any(AbortSignal),
    );
  });

  it("keeps reflections available when professional appointments fail to load", async () => {
    mocks.listItems.mockResolvedValue([]);
    mocks.listAppointments.mockRejectedValue(new Error("Appointments unavailable"));
    mocks.listEntries.mockResolvedValue({
      success: true,
      data: { entries: [{
        id: "journal-1", title: "A quiet page", body: "Today felt calm", excerpt: "Today felt calm",
        mood: "calm", createdAt: new Date().toISOString(), analysisConsent: false,
      }], pagination: { totalPages: 1 } },
    });

    render(<CalendarView />);
    expect(await screen.findByRole("link", { name: "A quiet page" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("No professional appointments on this day.")).toBeInTheDocument();
  });
});

it('refreshes only appointments on focus without rereading journals or their analysis',async()=>{
 mocks.listItems.mockResolvedValue([]);mocks.listEntries.mockResolvedValue({success:true,data:{entries:[],pagination:{totalPages:1}}});mocks.listAppointments.mockResolvedValue({appointments:[]});render(<CalendarView/>);await waitFor(()=>expect(screen.getByText(/0 reflections/)).toBeInTheDocument());const journals=mocks.listEntries.mock.calls.length,analysis=mocks.getAnalysis.mock.calls.length;window.dispatchEvent(new Event('focus'));await waitFor(()=>expect(mocks.listAppointments).toHaveBeenCalledTimes(2));expect(mocks.listEntries).toHaveBeenCalledTimes(journals);expect(mocks.getAnalysis).toHaveBeenCalledTimes(analysis);
});
