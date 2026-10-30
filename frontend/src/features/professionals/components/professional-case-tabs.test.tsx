import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { ProfessionalCaseTabs } from "./professional-case-tabs";
it("does not mount inactive heavy panels until first use, then keeps them mounted for drafts", async () => {
  const mount = vi.fn(), unmount = vi.fn();
  function Heavy() { useEffect(() => { mount(); return unmount; }, []); return <p>Heavy case panel</p>; }
  render(<ProfessionalCaseTabs overview={<p>Overview</p>} conversation={<Heavy />} appointments={null} care={null} history={null} />);
  expect(mount).not.toHaveBeenCalled(); expect(screen.queryByText("Heavy case panel")).toBeNull();
  const user = userEvent.setup(); await user.click(screen.getByRole("tab", { name: "Conversation" }));
  expect(mount).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("tab", { name: "Overview" }));
  expect(screen.getByText("Heavy case panel")).not.toBeVisible(); expect(unmount).not.toHaveBeenCalled();
});
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
