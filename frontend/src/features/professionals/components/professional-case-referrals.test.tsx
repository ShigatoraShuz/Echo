import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { referralValidation, safeReferralUrl } from "../professional-referrals.model";
import { ProfessionalCaseReferrals } from "./professional-case-referrals";

describe("FE-023 referral contracts", () => {
  it.each(["", " x ", "x".repeat(161)])("rejects invalid resource name length", (name) => expect(referralValidation(name, "").name).not.toBe(""));
  it("accepts trimmed API boundaries and optional secure links", () => {
    expect(referralValidation(" ab ", "")).toEqual({ name: "", url: "" }); expect(referralValidation("x".repeat(160), "https://example.invalid/resource")).toEqual({ name: "", url: "" });
  });
  it.each(["javascript:alert(1)", "http://example.invalid", "not a URL", "https://user:secret@example.invalid"])("rejects unsafe website %s", (url) => { expect(safeReferralUrl(url)).toBeNull(); expect(referralValidation("Resource", url).url).not.toBe(""); });
  it("does not render unsafe stored URLs or invent delivery statuses", async () => {
    const { container } = render(<ProfessionalCaseReferrals readOnly referrals={[{ id: "old", resourceName: "Old resource", resourceUrl: "javascript:alert(1)", createdAt: "2026-10-01T08:00:00Z" }, { id: "new", resourceName: "New resource", resourceUrl: "https://example.invalid/resource", createdAt: "2026-10-02T08:00:00Z" }]} />);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("New resource"); expect(screen.queryByRole("link", { name: "Old resource" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New resource/ })).toHaveAttribute("rel", "noopener noreferrer"); expect(screen.getByRole("button", { name: "Referral status updates unavailable" })).toBeDisabled();
    expect(screen.getByText(/Delivery, acceptance and referral status history are not supplied/)).toBeInTheDocument(); expect(await axe(container)).toHaveNoViolations();
  });
});
