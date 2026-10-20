import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const settings = vi.hoisted(() => ({ getDeletionCenter: vi.fn(), cancelDeletion: vi.fn(), requestExport: vi.fn(), downloadExport: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/services/settings/settings.service", () => ({ settingsService: settings }));

import DeletionPage from "./page";

beforeEach(() => vi.clearAllMocks());

it("keeps a pending account in the deletion center and allows cancellation", async () => {
  settings.getDeletionCenter.mockResolvedValue({
    deletionRequest: { id: "41000000-0000-4000-8000-000000000001", status: "pending", scheduledFor: "2026-11-14T00:00:00Z" },
    exportHistory: [],
  });
  settings.cancelDeletion.mockResolvedValue({ status: "cancelled" });
  render(<DeletionPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
  await waitFor(() => expect(settings.cancelDeletion).toHaveBeenCalledWith("41000000-0000-4000-8000-000000000001"));
  expect(navigation.replace).toHaveBeenCalledWith("/settings/privacy");
});

it("does not offer export or cancellation after processing begins", async () => {
  settings.getDeletionCenter.mockResolvedValue({
    deletionRequest: { id: "41000000-0000-4000-8000-000000000001", status: "processing", scheduledFor: "2026-11-14T00:00:00Z" },
    exportHistory: [],
  });
  render(<DeletionPage />);
  expect(await screen.findByText(/being deleted/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Request export" })).not.toBeInTheDocument();
});
