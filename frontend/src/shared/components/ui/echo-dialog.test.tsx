import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EchoDialog } from "./echo-dialog";

describe("EchoDialog", () => {
  it("covers the app shell while preserving scroll and close behavior", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div className="relative z-10">
        <EchoDialog open onClose={onClose} title="Check-in">
          <p>Long form content</p>
        </EchoDialog>
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Check-in" });
    const overlay = dialog.parentElement;
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay).toHaveClass("z-[400]");
    expect(dialog).toHaveClass("overflow-y-auto", "[scrollbar-width:none]", "[&::-webkit-scrollbar]:hidden");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <div className="relative z-10">
        <EchoDialog open={false} onClose={onClose} title="Check-in">
          <p>Long form content</p>
        </EchoDialog>
      </div>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(overlay).toHaveAttribute("data-state", "closing");
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });

  it("returns focus after closing and keeps scroll locked while another dialog opens", async () => {
    const onClose = vi.fn();
    const content = (firstOpen: boolean, secondOpen: boolean) => (
      <>
        <button type="button">Open first</button>
        <EchoDialog open={firstOpen} onClose={onClose} title="First"><button type="button">First action</button></EchoDialog>
        <EchoDialog open={secondOpen} onClose={onClose} title="Second"><button type="button">Second action</button></EchoDialog>
      </>
    );
    const { rerender } = render(content(false, false));
    const trigger = screen.getByRole("button", { name: "Open first" });
    trigger.focus();
    rerender(content(true, false));
    expect(screen.getByRole("dialog", { name: "First" })).toHaveFocus();
    rerender(content(false, true));
    expect(screen.getByRole("dialog", { name: "Second" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(content(false, false));
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
    expect(trigger).toHaveFocus();
  });
});
