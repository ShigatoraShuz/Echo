import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalFollowUps, type SyntheticFollowUp } from "./professional-follow-ups";

const tasks: SyntheticFollowUp[] = [
  { id: "pending", organizationId: "org-one", caseId: "fictional-one", kind: "prepare", status: "pending", dueAt: "2026-10-12T10:00:00Z", practitioner: "Fictional Alex" },
  { id: "done", organizationId: "org-one", caseId: "fictional-two", kind: "review", status: "completed", dueAt: "2026-10-11T10:00:00Z", practitioner: "Fictional Alex" },
  { id: "foreign", organizationId: "org-two", caseId: "foreign-case", kind: "follow_up", status: "pending", dueAt: "2026-10-11T10:00:00Z", practitioner: "Foreign practitioner" },
];
describe("FE-022 follow-up presentation", () => {
  it("shows an honest unavailable state without production task records or counts", () => {
    render(<ProfessionalFollowUps />); expect(screen.getByRole("button", { name: "Create follow-up unavailable" })).toBeDisabled(); expect(screen.queryByRole("list")).not.toBeInTheDocument(); expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("demonstrates scoped pending/completed tasks, due dates and disabled mutations", async () => {
    const { container } = render(<ProfessionalFollowUps preview={{ organizationId: "org-one", tasks }} now={Date.parse("2026-10-13T10:00:00Z")} />);
    expect(screen.getByText("Prepare for consultation")).toBeInTheDocument(); expect(screen.getByText(/Overdue in this synthetic scenario/)).toBeInTheDocument(); expect(screen.queryByText(/Foreign practitioner/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete task unavailable" })).toBeDisabled(); expect(screen.getByRole("link")).toHaveAttribute("href", "#sample-case");
    await userEvent.click(screen.getByRole("button", { name: "Completed" })); expect(screen.getByText("Review agreed next steps")).toBeInTheDocument(); expect(screen.queryByText("Prepare for consultation")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Reopen task unavailable" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
  it.each(["loading", "error", "empty"] as const)("hides fixture records in %s state", (state) => {
    render(<ProfessionalFollowUps preview={{ organizationId: "org-one", tasks }} state={state} />); expect(screen.queryByText("Prepare for consultation")).not.toBeInTheDocument(); expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("drops the previous organization's task records on context change", () => {
    const { rerender } = render(<ProfessionalFollowUps preview={{ organizationId: "org-one", tasks }} />);
    rerender(<ProfessionalFollowUps preview={{ organizationId: "org-empty", tasks }} />); expect(screen.queryByText(/Fictional Alex/)).not.toBeInTheDocument(); expect(screen.getByRole("status")).toHaveTextContent("No pending synthetic");
  });
});
