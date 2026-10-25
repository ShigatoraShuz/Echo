import type { AnchorHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfessionalClinicianPreview } from "./professional-clinician-preview";
import { clinicianDemo, clinicianPersonas } from "./clinician-preview-fixtures";
import { professionalPreviewExit } from "./professional-preview-navigation";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), logout: vi.fn(), replace: vi.fn(), refresh: vi.fn(), api: Object.fromEntries(["memberships", "queue", "dashboard", "caseDetail", "caseMessages", "markCaseMessagesRead", "sendCaseMessage", "claim", "assign", "addNote", "proposeAppointment", "addReferral"].map(name => [name, vi.fn()])) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dev/professional-preview", useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/services/authentication/auth-service.factory", () => ({ getAuthService: () => ({ logout: mocks.logout }) }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: mocks.api }));
vi.mock("next/link", () => ({ default: ({ href, onNavigate, children, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: () => void; prefetch?: boolean }) => { void _prefetch; return <a {...props} href={href} onClick={event => { event.preventDefault(); onNavigate?.(); window.history.pushState(null, "", href); }}>{children}</a>; } }));
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubGlobal("fetch", mocks.fetch); window.history.replaceState(null, "", "/dev/professional-preview?returnOrganization=real-admin-org"); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const casesNav = () => within(screen.getByRole("navigation", { name: "Professional workspace" })).getByRole("link", { name: "My cases" });
function expectNoLiveCalls() { for (const spy of [mocks.fetch, mocks.logout, mocks.replace, mocks.refresh, ...Object.values(mocks.api)]) expect(spy).not.toHaveBeenCalled(); }

describe("isolated clinician demonstration", () => {
  it("uses deterministic fixtures without memberships or fabricated credentials", () => {
    for (const persona of clinicianPersonas) { expect(clinicianDemo(persona.id)).toEqual(clinicianDemo(persona.id)); expect(clinicianDemo(persona.id).actorId).toBe("demo-" + persona.id); }
    render(<ProfessionalClinicianPreview />);
    expect(screen.getByText("Demo Preview — Fictional Data", { exact: true })).toBeVisible();
    expect(screen.getByLabelText("Demo organization")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Exit Preview" })).toHaveAttribute("href", "/professional?organization=real-admin-org");
    expectNoLiveCalls();
  });
  it("shares real caseload controls and navigates only to known fictional cases", async () => {
    render(<ProfessionalClinicianPreview />); await userEvent.click(casesNav());
    expect(screen.getByRole("group", { name: "Caseload status" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Closed" }));
    expect(screen.getByRole("heading", { name: "Case DEMO1003" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Case DEMO1001" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "All cases" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Open demo case" })[0]);
    expect(screen.getByRole("region", { name: "Case overview" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Case activity timeline" })).toHaveTextContent("Case assigned");
    expect(screen.getByLabelText("New case note")).toBeDisabled(); expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Record referral" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close case" })).toBeDisabled();
    await userEvent.click(screen.getByText("Fictional reflection — a calmer week", { exact: true }));
    expect(screen.getByText(/Fictional reflection for the Echo clinician demonstration/)).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText("Fictional sharing state"), "revoked");
    expect(screen.queryByText(/Fictional reflection for the Echo clinician demonstration/)).not.toBeInTheDocument();
    expectNoLiveCalls();
  });
  it("renders the shared message drawer with fictional threads and inert sending", async () => {
    render(<ProfessionalClinicianPreview />); await userEvent.click(screen.getByRole("button", { name: "Messages" }));
    const drawer = screen.getByRole("dialog", { name: "Messages" });
    expect(within(drawer).getByText("Demo Preview — Fictional Data", { exact: true })).toBeVisible();
    await userEvent.click(within(drawer).getByRole("button", { name: /Case DEMO1001/ }));
    expect(within(drawer).getByText(/Fictional message: I would like/)).toBeVisible();
    const send = within(drawer).getByRole("button", { name: "Send" }); expect(send).toBeDisabled(); fireEvent.click(send);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expectNoLiveCalls();
  });
  it("clears prior persona filters and case state without changing an auth role", async () => {
    render(<ProfessionalClinicianPreview />); await userEvent.click(casesNav()); await userEvent.click(screen.getByRole("button", { name: "Closed" }));
    await userEvent.selectOptions(screen.getByLabelText("Clinician persona"), "psychologist");
    expect(screen.getByRole("heading", { name: "Case DEMO2001" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /DEMO100/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All cases" })).toHaveAttribute("aria-pressed", "true");
    expectNoLiveCalls();
  });
  it("never sends arbitrary URL case identifiers to a service", () => {
    window.history.replaceState(null, "", "/dev/professional-preview#case/real-case-id"); render(<ProfessionalClinicianPreview />);
    expect(screen.getByRole("heading", { name: "Unknown demo case" })).toBeVisible(); expectNoLiveCalls();
  });
  it("clears an open fictional conversation on account invalidation", async () => {
    render(<ProfessionalClinicianPreview />); await userEvent.click(screen.getByRole("button", { name: "Messages" }));
    act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared"))); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expectNoLiveCalls();
  });
  it("does not render in production", () => { vi.stubEnv("NODE_ENV", "production"); const { container } = render(<ProfessionalClinicianPreview />); expect(container).toBeEmptyDOMElement(); expectNoLiveCalls(); });
  it.each(["https://attacker.invalid", "//attacker.invalid", "org?preview=1", "../org", ""]) ("rejects unsafe exit organization %s", value => expect(professionalPreviewExit(value)).toBe("/professional"));
});
