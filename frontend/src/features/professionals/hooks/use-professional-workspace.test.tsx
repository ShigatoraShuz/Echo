import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfessionalWorkspaceGate } from "../components/professional-workspace-gate";
import { useProfessionalWorkspace } from "./use-professional-workspace";
import { AppError } from "@/shared/errors/app-error";

const api = vi.hoisted(() => ({ memberships: vi.fn(), queue: vi.fn(), dashboard: vi.fn() }));
const navigation = vi.hoisted(() => ({ pathname: "/professional", params: new URLSearchParams("organization=org-one"), replace: vi.fn() }));
vi.mock("@/services/professionals/professional-api", () => ({ professionalApi: api }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useSearchParams: () => navigation.params, useRouter: () => navigation }));
vi.mock("../components/professional-shell", () => ({ ProfessionalShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, ProfessionalSkeleton: () => <p>Checking access</p> }));
const members = ["org-one", "org-two"].map(id => ({ id, organizationId: id, role: "counselor", status: "active", accessState: "active", organization: { id, name: id, status: "active" } }));
const queue = (org: string) => ({ requests: [{ id: org + "-request", organizationId: org, assignedTo: "actor", status: "assigned", createdAt: "2026-10-01", updatedAt: "2026-10-01" }], page: { total: 1, offset: 0, limit: 100, hasMore: false } });
const summary = (org: string) => ({ organizationId: org, userId: "actor", counts: { pendingCount: 0, activeCount: 1, scheduledCount: 0 }, scheduledCases: [], appointments: [], appointmentTotal: 0 });
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function Probe() {
  const state = useProfessionalWorkspace(navigation.pathname, navigation.pathname.endsWith("resources") ? "none" : navigation.pathname.endsWith("calendar") ? "schedule" : "queue");
  return <div><button onClick={state.refreshWorkspace}>Refresh</button><button onClick={() => state.switchOrganization("org-two")}>Switch</button><span>{state.error ? "denied" : state.requests === null ? "waiting" : state.organizationId + ":" + state.requests.map(r => r.id).join(",")}</span></div>;
}
const view = () => <ProfessionalWorkspaceGate><Probe /></ProfessionalWorkspaceGate>;
beforeEach(() => {
  navigation.pathname = "/professional"; navigation.params = new URLSearchParams("organization=org-one");
  api.memberships.mockResolvedValue({ userId: "actor", mfaRequired: false, memberships: members });
  api.queue.mockImplementation(async (org: string) => queue(org));
  api.dashboard.mockImplementation(async (org: string) => summary(org));
});

it("uses one fresh membership read for the route gate and workspace", async () => {
  render(view()); await screen.findByText("org-one:org-one-request");
  expect(api.memberships).toHaveBeenCalledTimes(1); expect(api.queue).toHaveBeenCalledTimes(1); expect(api.dashboard).toHaveBeenCalledTimes(1);
});
it("shares a pending gate check during Strict Mode replay", async () => {
  const check = pending<{ userId: string; mfaRequired: boolean; memberships: typeof members }>(); api.memberships.mockReturnValue(check.promise);
  render(<StrictMode>{view()}</StrictMode>);
  expect(api.memberships).toHaveBeenCalledTimes(1);
  await act(async () => check.resolve({ userId: "actor", mfaRequired: false, memberships: members }));
  await screen.findByText("org-one:org-one-request"); expect(api.memberships).toHaveBeenCalledTimes(1); expect(api.queue).toHaveBeenCalledTimes(1); expect(api.dashboard).toHaveBeenCalledTimes(1);
});
it("starts the dashboard while the independent queue is still pending", async () => {
  const read = pending<ReturnType<typeof queue>>(); api.queue.mockReturnValue(read.promise);
  render(view()); await waitFor(() => expect(api.dashboard).toHaveBeenCalledTimes(1));
  expect(screen.getByText("waiting")).toBeVisible();
  await act(async () => read.resolve(queue("org-one"))); await screen.findByText("org-one:org-one-request");
});
it("rechecks membership and discards the previous route result on navigation", async () => {
  const mounted = render(view()); await screen.findByText("org-one:org-one-request");
  navigation.pathname = "/professional/requests"; const check = pending<unknown>(); api.memberships.mockReturnValue(check.promise);
  mounted.rerender(view()); expect(screen.queryByText("org-one:org-one-request")).not.toBeInTheDocument();
  await act(async () => check.resolve({ userId: "actor", mfaRequired: false, memberships: members }));
  await screen.findByText("org-one:org-one-request"); expect(api.memberships).toHaveBeenCalledTimes(2); expect(api.dashboard).toHaveBeenCalledTimes(1);
});
it("clears immediately on organization selection and ignores the old queue and summary", async () => {
  const oldQueue = pending<ReturnType<typeof queue>>(), oldSummary = pending<ReturnType<typeof summary>>();
  api.queue.mockReturnValueOnce(oldQueue.promise); api.dashboard.mockReturnValueOnce(oldSummary.promise);
  const mounted = render(view()); await waitFor(() => expect(api.queue).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText("Switch")); expect(screen.getByText("waiting")).toBeVisible();
  navigation.params = new URLSearchParams("organization=org-two"); mounted.rerender(view());
  await screen.findByText("org-two:org-two-request");
  await act(async () => { oldQueue.resolve(queue("org-one")); oldSummary.resolve(summary("org-one")); });
  expect(screen.queryByText("org-one:org-one-request")).not.toBeInTheDocument(); expect(api.memberships).toHaveBeenCalledTimes(2);
});
it("explicit refresh revalidates membership and never reuses gate approval after revocation", async () => {
  render(view()); await screen.findByText("org-one:org-one-request");
  api.memberships.mockResolvedValue({ userId: "actor", mfaRequired: false, memberships: members.map(m => ({ ...m, status: "suspended", accessState: "suspended_membership" })) });
  fireEvent.click(screen.getByText("Refresh")); expect(screen.queryByText("org-one:org-one-request")).not.toBeInTheDocument();
  await screen.findByText("denied"); expect(api.memberships).toHaveBeenCalledTimes(2); expect(api.queue).toHaveBeenCalledTimes(1);
});
it("clears route-scoped state on logout/account invalidation, including an in-flight load", async () => {
  const read = pending<ReturnType<typeof queue>>(); api.queue.mockReturnValue(read.promise);
  render(view()); await waitFor(() => expect(api.queue).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new Event("echo:sensitive-state-cleared")));
  expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
  await act(async () => read.resolve(queue("org-one")));
  expect(screen.queryByText("org-one:org-one-request")).not.toBeInTheDocument();
});
it.each([401,403,404])("conceals queue data when the concurrent summary denies access (%s)", async statusCode => {
  api.dashboard.mockRejectedValue(new AppError({ code: "AUTHORIZATION_ERROR", statusCode, userMessage: "Private diagnostic" }));
  render(view()); await screen.findByText("denied"); expect(screen.queryByText("org-one:org-one-request")).not.toBeInTheDocument();
});
it("MFA requirements stop all workspace data requests", async () => {
  api.memberships.mockResolvedValue({ userId: "actor", mfaRequired: true, memberships: members });
  render(view()); await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  expect(api.queue).not.toHaveBeenCalled(); expect(api.dashboard).not.toHaveBeenCalled();
});
it("administrator Calendar does not fetch a clinical dashboard", async () => {
  navigation.pathname = "/professional/calendar";
  api.memberships.mockResolvedValue({ userId: "actor", mfaRequired: false, memberships: members.map(m => ({ ...m, role: "org_admin" })) });
  render(view()); await screen.findByText("org-one:");
  expect(api.queue).not.toHaveBeenCalled(); expect(api.dashboard).not.toHaveBeenCalled();
});

it("does not wait for a missing legacy aggregation endpoint", async () => {
  api.queue.mockResolvedValue({ requests: queue("org-one").requests });
  api.dashboard.mockReturnValue(new Promise(() => {}));
  render(view()); await screen.findByText("org-one:org-one-request");
});
