import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EchoSheet } from "./echo-sheet";

describe("EchoSheet", () => {
  it("traps focus, closes on Escape, and returns focus after its exit", async () => {
    const onClose = vi.fn();
    const content = (open: boolean) => (
      <>
        <button type="button">Open panel</button>
        <EchoSheet open={open} onClose={onClose} title="Details">
          <button type="button">Panel action</button>
        </EchoSheet>
      </>
    );
    const { rerender } = render(content(false));
    const trigger = screen.getByRole("button", { name: "Open panel" });
    trigger.focus();
    rerender(content(true));
    const panel = screen.getByRole("dialog", { name: "Details" });
    expect(panel).toHaveFocus();
    expect(panel.parentElement?.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    rerender(content(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});
