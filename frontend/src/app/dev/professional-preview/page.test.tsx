import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfessionalPreviewPage from "./page";

const mocks = vi.hoisted(() => ({ headers: vi.fn(), notFound: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/professionals/dev/professional-clinician-preview", () => ({ ProfessionalClinicianPreview: () => null }));
vi.mock("@/features/professionals/dev/professional-preview", () => ({ ProfessionalPreview: () => null }));

beforeEach(() => {
  mocks.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("local professional preview route", () => {
  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])("renders in development for %s", async (host) => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.headers.mockResolvedValue(new Headers({ host }));
    expect(await ProfessionalPreviewPage({})).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("retains the isolated component laboratory with a safe Exit Preview", async () => {
    vi.stubEnv("NODE_ENV", "development"); mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    render(await ProfessionalPreviewPage({ searchParams: Promise.resolve({ view: "lab", returnOrganization: "admin-org" }) }));
    expect(screen.getByRole("link", { name: "Exit Preview" })).toHaveAttribute("href", "/professional?organization=admin-org");
  });

  it.each(["production", "test"])("returns not found in %s even with a local host", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000" }));
    await expect(ProfessionalPreviewPage({})).rejects.toThrow("NOT_FOUND");
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it.each(["echo.example", "localhost.attacker.example:3000", "192.168.1.10:3000", "user@localhost:3000", "localhost:3000/path", ""])("rejects development requests with host %s", async (host) => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.headers.mockResolvedValue(new Headers({ host }));
    await expect(ProfessionalPreviewPage({})).rejects.toThrow("NOT_FOUND");
  });
});
