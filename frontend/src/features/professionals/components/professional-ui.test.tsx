import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { ProfessionalRequestRow, ProfessionalRequestStatus } from "./professional-ui";

it.each([
  ["submitted", "New request"], ["assigned", "Accepted"], ["scheduled", "Scheduled"],
  ["closed", "Closed"], ["declined", "Declined"], ["unsupported-status", "Status unavailable"], ["", "Status unavailable"],
])("presents %s without inventing a lifecycle outcome", (status, label) => {
  render(<ProfessionalRequestStatus status={status} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  if (label === "Status unavailable") expect(screen.queryByText("Declined")).not.toBeInTheDocument();
});

it("keeps request metadata available through an accessible mobile disclosure", async () => {
  render(<ul><ProfessionalRequestRow id="FICTIONAL" status="submitted" submittedAt="Oct 1" fullId="fictional-request-id" updatedAt="Oct 2" assignment="Unassigned" action={<button type="button">Accept request</button>} /></ul>);
  const toggle = screen.getByRole("button", { name: "Request details" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  const details = document.getElementById(toggle.getAttribute("aria-controls")!);
  expect(details).toHaveTextContent("ID: fictional-request-id");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveTextContent("Hide details");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Accept request" })).toBeEnabled();
});
