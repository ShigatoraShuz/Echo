import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfessionalPreviewEntry } from "./professional-preview-entry";
afterEach(() => vi.unstubAllEnvs());
it("offers the unchanged development preview only to an organization administrator", () => {
  vi.stubEnv("NODE_ENV", "development");
  render(<ProfessionalPreviewEntry role="org_admin" organizationId="fictional-org" />);
  expect(screen.getByRole("link", { name: "Preview as Professional" })).toHaveAttribute("href", "/dev/professional-preview?returnOrganization=fictional-org");
});
it("does not offer it to a clinician", () => {
  vi.stubEnv("NODE_ENV", "development");
  render(<ProfessionalPreviewEntry role="counselor" organizationId="fictional-org" />);
  expect(screen.queryByRole("link")).toBeNull();
});
it("does not offer the entry in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  render(<ProfessionalPreviewEntry role="org_admin" organizationId="fictional-org" />);
  expect(screen.queryByRole("link")).toBeNull();
});
