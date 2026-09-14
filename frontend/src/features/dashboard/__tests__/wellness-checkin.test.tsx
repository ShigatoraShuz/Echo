import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WellnessStatus } from "@echo/contracts";
import { WellnessCheckin } from "../components/wellness-checkin";

const api = vi.hoisted(() => ({
  getWellnessStatus: vi.fn(),
  savePhq8: vi.fn(),
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
  it("dismisses lower-priority screening when an urgent analysis signal arrives", async () => {
    render(<WellnessCheckin />);

    await screen.findByRole("dialog");

    await act(async () => {
      window.dispatchEvent(new CustomEvent("echo:safety-support"));

      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("gives a due PHQ-8 precedence over repeated support and optional welcome", async () => {
    render(<WellnessCheckin />);

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("How have the last two weeks felt?");

    expect(api.claimSupportPrompt).not.toHaveBeenCalled();

    expect(
      screen.getByRole("button", {
        name: "Save check-in",
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Later",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Take the check-in",
      }),
    ).toBeEnabled();
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
    api.savePhq8.mockRejectedValue(new Error("offline"));

    render(<WellnessCheckin />);

    await screen.findByRole("dialog");

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

    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", {
          name: "Save check-in",
        }),
      ),
    );

    expect(api.savePhq8.mock.calls[0][0]).toEqual(api.savePhq8.mock.calls[1][0]);

    expect(api.savePhq8.mock.calls[0][0].responses).toEqual(Array(8).fill(1));
  });
});
