import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalCaseTabs } from "./professional-case-tabs";
it("supports roving keyboard tabs and preserves a private draft through tab changes", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <ProfessionalCaseTabs
      overview={<p>Case summary</p>}
      conversation={<p>Conversation</p>}
      appointments={<p>Schedule</p>}
      care={
        <label>
          Private draft
          <textarea />
        </label>
      }
      history={<p>History</p>}
    />,
  );
  screen.getByRole("tab", { name: "Overview" }).focus();
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  await user.type(screen.getByLabelText("Private draft"), "Fictional draft only");
  await user.click(screen.getByRole("tab", { name: "Overview" }));
  expect(screen.getByLabelText("Private draft")).not.toBeVisible();
  await user.click(screen.getByRole("tab", { name: "Notes and care coordination" }));
  expect(screen.getByLabelText("Private draft")).toHaveValue("Fictional draft only");
  expect(await axe(container)).toHaveNoViolations();
});
