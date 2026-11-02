import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { JournalSupportPanel } from "./journal-support-panel";
vi.mock("./support-action", () => ({
  SupportAction: ({
    children,
    destination,
  }: {
    children: React.ReactNode;
    destination: string;
  }) => (
    <a
      href={
        destination === "professional"
          ? "/professional-support"
          : "/tools/grounding"
      }
    >
      {children}
    </a>
  ),
}));
const resource = {
  id: "fixture-contact",
  resource_name: "Fictional verified test line",
  organization_name: "Test organization",
  phone_number: "+10000000000",
};
it("puts the highest ordered callable resource and professional choice before other help", () => {
  render(
    <JournalSupportPanel
      resources={[
        resource,
        { ...resource, id: "second", phone_number: "+10000000001" },
      ]}
    />,
  );
  const primary = screen.getByRole("region", {
    name: "Priority support options",
  });
  expect(primary.querySelector('a[href="tel:+10000000000"]')).not.toBeNull();
  expect(
    screen.getByRole("link", { name: /Talk to a professional/ }),
  ).toHaveAttribute("href", "/professional-support");
  expect(
    screen.getByRole("link", { name: /Open grounding exercises/ }),
  ).toHaveAttribute("href", "/tools/grounding");
  expect(screen.getByText(/Requests are reviewed/)).toBeVisible();
});
it("keeps professional support available during failure and rejects unsafe contact links", () => {
  render(
    <JournalSupportPanel
      resources={[
        {
          ...resource,
          phone_number: "javascript:bad",
          website_url: "javascript:bad",
        },
      ]}
      failed
    />,
  );
  expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(
    screen.getByRole("link", { name: /Talk to a professional/ }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Open verified support options" }),
  ).toBeVisible();
});
