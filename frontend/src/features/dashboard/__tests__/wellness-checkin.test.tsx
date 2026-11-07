import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeSelfReportedPhq8, type WellnessStatus } from "@echo/contracts";
import { WellnessCheckin } from "../components/wellness-checkin";

const api = vi.hoisted(() => ({
  getWellnessStatus: vi.fn(),
  savePhq8: vi.fn(),
  saveSelfReportedPhq8: vi.fn(),
  claimSupportPrompt: vi.fn(),
}));

vi.mock("@/services/experience/experience-api", () => ({
  experienceApi: api,
}));

const status: WellnessStatus = {
  assessment: {
    due: true,
    dueAt: null,
    intervalDays: 7,
    history: [],
  },
  support: {
    eligible: true,
    count: 3,
    windowDays: 14,
  },
  urgentJournalId: null,
};

beforeEach(() => {
  vi.clearAllMocks();

  window.localStorage.clear();
  window.sessionStorage.clear();

  api.getWellnessStatus.mockResolvedValue(status);

  api.claimSupportPrompt.mockResolvedValue({
    show: true,
  });
});

describe("dashboard check-in order", () => {
  it("saves a partial self-report without converting missing answers to zero or inventing a total", async () => {
    const responses = [1, null, null, null, null, null, null, null];
    api.saveSelfReportedPhq8.mockResolvedValue({ id: "partial", completedAt: new Date().toISOString(), ...summarizeSelfReportedPhq8(responses) });
    render(<WellnessCheckin />);
    fireEvent.click(await screen.findByRole("button", { name: "Open check-in panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));
    fireEvent.click(screen.getAllByRole("radio", { name: "Several days" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await screen.findByText(/No complete total or severity is calculated/);
    expect(api.saveSelfReportedPhq8).toHaveBeenCalledWith(expect.objectContaining({ responses }));
    expect(screen.getAllByText("Unanswered")).toHaveLength(7);
    expect(screen.getByText(/SELF-REPORTED PHQ-8/)).toBeInTheDocument();
  });
  it("keeps the dashboard preview interactive without contacting the backend", () => {
    render(<WellnessCheckin preview />);

    expect(api.getWellnessStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open check-in panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("How have the last two weeks felt?");
    expect(screen.getByText(/your answers stay on this page/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 8 answered");
    expect(screen.getByRole("button", { name: "Save check-in" })).toBeEnabled();

    fireEvent.click(
      within(screen.getByRole("group", { name: "1. Little interest or pleasure in doing things" })).getByRole(
        "radio",
        { name: "Not at all" },
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 of 8 answered");
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    fireEvent.click(screen.getByRole("button", { name: "Open check-in panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 of 8 answered");

    screen.getAllByRole("radio", { name: "Not at all" }).forEach((option) => fireEvent.click(option));
    expect(screen.getByRole("status")).toHaveTextContent("8 of 8 answered");
    expect(screen.getByRole("button", { name: "Save check-in" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Preview check-in complete");
    expect(api.saveSelfReportedPhq8).not.toHaveBeenCalled();
  });

  it("slides the edge tab open on hover and focus, and keeps closed actions out of the tab order", () => {
    render(<WellnessCheckin preview />);

    const dock = screen.getByRole("complementary", { name: "Your check-in" });
    const trigger = screen.getByRole("button", { name: "Open check-in panel" });
    expect(dock.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Take the check-in" })).not.toBeInTheDocument();

    fireEvent.mouseEnter(dock);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Take the check-in" })).toBeVisible();

    fireEvent.mouseLeave(dock);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(dock, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses lower-priority screening when an urgent analysis signal arrives", async () => {
    render(<WellnessCheckin />);

    await screen.findByRole("button", { name: "Open check-in panel" });
    fireEvent.click(screen.getByRole("button", { name: "Open check-in panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new CustomEvent("echo:safety-support"));

      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("offers a due PHQ-8 from the edge without opening a dashboard modal automatically", async () => {
    render(<WellnessCheckin />);

    const trigger = await screen.findByRole("button", { name: "Open check-in panel" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(api.claimSupportPrompt).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("How have the last two weeks felt?");

    expect(
      screen.getByRole("button", {
        name: "Save check-in",
      }),
    ).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Later",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps urgent support available without opening a screening modal", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      urgentJournalId: "journal-1",
    });

    render(<WellnessCheckin />);

    expect(
      await screen.findByRole("link", {
        name: "Open crisis support",
      }),
    ).toHaveAttribute("href", "/crisis");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(api.claimSupportPrompt).not.toHaveBeenCalled();
  });

  it("claims a persisted support prompt before falling back to the optional welcome", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      assessment: {
        ...status.assessment,
        due: false,
        dueAt: "2026-09-20T00:00:00Z",
      },
    });

    api.claimSupportPrompt.mockResolvedValue({
      show: false,
    });

    render(<WellnessCheckin />);

    await waitFor(() => expect(api.claimSupportPrompt).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Welcome back to ECHO");

    expect(
      screen.queryByRole("dialog", {
        name: /last two weeks/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the welcome modal when no higher-priority check-in is needed", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      assessment: {
        ...status.assessment,
        due: false,
        dueAt: "2026-09-20T00:00:00Z",
      },
      support: {
        ...status.support,
        eligible: false,
      },
    });

    render(<WellnessCheckin />);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Welcome back to ECHO");

    expect(api.claimSupportPrompt).not.toHaveBeenCalled();
  });

  it("opens the optional AI introduction after the welcome modal", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      assessment: {
        ...status.assessment,
        due: false,
        dueAt: "2026-09-20T00:00:00Z",
      },
      support: {
        ...status.support,
        eligible: false,
      },
    });

    render(<WellnessCheckin />);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Welcome back to ECHO");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue",
      }),
    );

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("AI analysis is optional");

    expect(
      screen.getByRole("link", {
        name: "Review AI settings",
      }),
    ).toHaveAttribute("href", "/settings");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Maybe later",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not repeat the welcome modal during the same browser session", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      assessment: {
        ...status.assessment,
        due: false,
        dueAt: "2026-09-20T00:00:00Z",
      },
      support: {
        ...status.support,
        eligible: false,
      },
    });

    const first = render(<WellnessCheckin />);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Welcome back to ECHO");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Not now",
      }),
    );

    first.unmount();

    render(<WellnessCheckin />);

    await waitFor(() => expect(api.getWellnessStatus).toHaveBeenCalledTimes(2));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not repeat the AI introduction after it has been acknowledged", async () => {
    api.getWellnessStatus.mockResolvedValue({
      ...status,
      assessment: {
        ...status.assessment,
        due: false,
        dueAt: "2026-09-20T00:00:00Z",
      },
      support: {
        ...status.support,
        eligible: false,
      },
    });

    window.localStorage.setItem("echo.dashboard.ai-intro-seen", "true");

    render(<WellnessCheckin />);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Welcome back to ECHO");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("retains all answers and submission identity after a failed save", async () => {
    api.saveSelfReportedPhq8.mockRejectedValue(new Error("offline"));

    render(<WellnessCheckin />);

    await screen.findByRole("button", { name: "Open check-in panel" });
    fireEvent.click(screen.getByRole("button", { name: "Open check-in panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Take the check-in" }));

    for (const radio of screen.getAllByRole("radio", {
      name: "Several days",
    })) {
      fireEvent.click(radio);
    }

    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Save check-in",
        }),
      ),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/answers are still here/i);
    expect(screen.getByRole("status")).toHaveTextContent("8 of 8 answered");

    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Save check-in",
        }),
      ),
    );

    expect(api.saveSelfReportedPhq8.mock.calls[0][0]).toEqual(api.saveSelfReportedPhq8.mock.calls[1][0]);

    expect(api.saveSelfReportedPhq8.mock.calls[0][0].responses).toEqual(Array(8).fill(1));
  });
});


describe("questionnaire dashboard card", () => {
  it("opens from the card, updates on save, and restores the same completed result on remount", async () => {
    const responses = [1, 1, 1, 1, 1, 1, 1, 1];
    const saved = { id: "synthetic-fixture", completedAt: "2026-11-08T00:00:00Z", ...summarizeSelfReportedPhq8(responses) };
    const completed = { ...status, support: { ...status.support, eligible: false }, assessment: {
      ...status.assessment, due: false, history: [{ id: saved.id, completedAt: saved.completedAt, score: 8, severity: "mild" as const }], selfReports: [saved],
    } };
    api.getWellnessStatus.mockResolvedValueOnce(status).mockResolvedValue(completed);
    api.saveSelfReportedPhq8.mockResolvedValue(saved);
    const view = render(<WellnessCheckin showGauge />);
    fireEvent.click(await screen.findByRole("button", { name: "Take PHQ-8 check-in" }));
    screen.getAllByRole("radio", { name: "Several days" }).forEach(option => fireEvent.click(option));
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "8"));
    expect(api.saveSelfReportedPhq8).toHaveBeenCalledWith(expect.objectContaining({ responses }));
    view.unmount();
    render(<WellnessCheckin showGauge />);
    await waitFor(() => expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "8"));
    fireEvent.click(screen.getByRole("button", { name: "View my check-in" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Your check-in is saved");
  });
});
