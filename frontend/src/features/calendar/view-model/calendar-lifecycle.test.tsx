import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { useCalendarViewModel } from "./use-calendar-view-model";

const h = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/services/calendar/calendar-api", () => ({ calendarApi: h }));
vi.mock("@/services/journal/journal-service.factory", () => ({ getJournalService: () => ({ listEntries: async () => ({ success: true, data: { entries: [], pagination: { totalPages: 1 } } }) }) }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: { appointments: async () => ({ appointments: [] }) } }));
beforeEach(() => { vi.clearAllMocks(); h.list.mockResolvedValue([]); });
describe("calendar invalidation during writes", () => {
  it("does not restore a saved private note from a late mutation after logout", async () => {
    let finish!: (value: object) => void;
    h.create.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useCalendarViewModel());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setContent("Fictional private reminder"));
    let saved!: Promise<void>;
    act(() => { saved = result.current.addItem({ preventDefault() {} } as FormEvent<HTMLFormElement>); });
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    await act(async () => { finish({ id: "fictional", scheduledOn: result.current.selected, content: "Fictional private reminder", kind: "note", completedAt: null }); await saved; });
    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.saving).toBe(false);
    expect(result.current.content).toBe("");
  });
  it("blocks new mutations after session invalidation", async () => {
    const { result } = renderHook(() => useCalendarViewModel());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
    const item = { id: "fictional", scheduledOn: result.current.selected, scheduledTime: null, kind: "note" as const, content: "Fictional", completedAt: null };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => { await result.current.toggleItem(item); await result.current.removeItem(item); });
    expect(h.update).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });
});
