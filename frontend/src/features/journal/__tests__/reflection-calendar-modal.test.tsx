import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCalendarDays, ReflectionCalendarModal, toLocalDateKey } from "@/features/journal/components/reflection-calendar-modal";

const listEntries = vi.fn();

vi.mock("../services/journal-service.factory", () => ({
  getJournalService: () => ({ listEntries }),
}));

describe("calendar date helpers", () => {
  it("builds a six-week Monday-first calendar grid", () => {
    const days = getCalendarDays(new Date(2026, 7, 1));

    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(toLocalDateKey(days[0])).toBe("2026-07-27");
    expect(toLocalDateKey(days[41])).toBe("2026-09-06");
  });
});

describe("ReflectionCalendarModal", () => {
  beforeEach(() => {
    listEntries.mockResolvedValue({
      success: true,
      data: {
        entries: [
          {
            id: "entry-1",
            title: "A quiet morning",
            createdAt: toLocalDateKey(new Date()),
          },
        ],
        pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
      },
    });
  });

  it("opens from the sidebar, changes month, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<ReflectionCalendarModal collapsed={false} />);

    await user.click(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("dialog", { name: "Reflection calendar" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    const currentMonth = screen.getByRole("heading", { level: 3 }).textContent;
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).not.toBe(currentMonth);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Reflection calendar" })).not.toBeInTheDocument();
    });
    expect(document.body.style.overflow).toBe("");
  });
});
