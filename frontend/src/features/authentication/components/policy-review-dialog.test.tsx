import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { PolicyBody, PolicyReviewDialog } from "./policy-review-dialog";
import type { PolicyDocument } from "@/services/authentication/registration-api";

const policy: PolicyDocument = {
  id: "first",
  document_type: "ai_analysis_notice",
  title: "AI Analysis Notice",
  version: "v2",
  summary: "Your analysis choices and limitations.",
  effective_at: "2026-08-31",
  sanitized_markdown: "## Optional analysis\n\nPermission is separate.\n\n- First choice\n- Second choice",
};
afterEach(() => vi.restoreAllMocks());
function mount() {
  const acknowledge = vi.fn();
  const close = vi.fn();
  const view = render(
    <PolicyReviewDialog key={policy.id} policy={policy} onAcknowledge={acknowledge} onClose={close} />,
  );
  return { ...view, acknowledge, close };
}
function dimensions(height: number, content: number) {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(content);
}

describe("Policy review reader", () => {
  it("renders headings and lists without raw Markdown or injected HTML", () => {
    const { container } = render(
      <PolicyBody content={"## Choices\\n\\n- Optional\\n- Private\\n\\n<script>alert(1)</script>"} />,
    );
    expect(screen.getByRole("heading", { name: "Choices" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("##");
  });
  it("requires an explicit acknowledgement, even after scrolling to the end", () => {
    dimensions(100, 1000);
    const { acknowledge, close } = mount();
    const button = screen.getByRole("button", { name: "Acknowledge and close" });
    expect(button).toBeDisabled();
    const region = screen.getByRole("region");
    fireEvent.scroll(region, { target: { scrollTop: 300 } });
    expect(button).toBeDisabled();
    fireEvent.scroll(region, { target: { scrollTop: 900 } });
    expect(button).toBeEnabled();
    expect(acknowledge).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(acknowledge).toHaveBeenCalledWith("first");
    expect(close).toHaveBeenCalledOnce();
  });
  it("enables acknowledgement without a scroll event when the document fits", async () => {
    dimensions(600, 300);
    const { acknowledge } = mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Acknowledge and close" })).toBeEnabled());
    expect(acknowledge).not.toHaveBeenCalled();
  });
  it("rechecks the reading area on resize", () => {
    dimensions(100, 1000);
    mount();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(1200);
    fireEvent.resize(window);
    expect(screen.getByRole("button", { name: "Acknowledge and close" })).toBeEnabled();
  });
  it("supports Page Down and End without moving the surrounding page", () => {
    dimensions(100, 1000);
    mount();
    const region = screen.getByRole("region");
    fireEvent.keyDown(region, { key: "PageDown" });
    expect(region.scrollTop).toBe(60);
    fireEvent.keyDown(region, { key: "End" });
    expect(region.scrollTop).toBe(900);
    expect(screen.getByRole("button", { name: "Acknowledge and close" })).toBeEnabled();
    fireEvent.keyDown(region, { key: "Home" });
    expect(region.scrollTop).toBe(0);
  });
  it("close and Escape do not mark a document reviewed", () => {
    const { acknowledge, close } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Close for now" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(close).toHaveBeenCalledTimes(2);
    expect(acknowledge).not.toHaveBeenCalled();
  });
  it("restores focus and body scroll on unmount", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    document.body.style.overflow = "auto";
    const { unmount } = mount();
    expect(screen.getByRole("region")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
    opener.remove();
    document.body.style.overflow = "";
  });
  it("does not transfer reading completion to a different version", () => {
    dimensions(100, 1000);
    const { rerender } = mount();
    fireEvent.scroll(screen.getByRole("region"), { target: { scrollTop: 900 } });
    rerender(
      <PolicyReviewDialog
        key="second"
        policy={{ ...policy, id: "second", version: "v3" }}
        onAcknowledge={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Acknowledge and close" })).toBeDisabled();
  });
  it("has a named dialog, document region and accessible controls", async () => {
    const { container } = mount();
    expect(screen.getByRole("dialog", { name: "AI Analysis Notice" })).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });
});
