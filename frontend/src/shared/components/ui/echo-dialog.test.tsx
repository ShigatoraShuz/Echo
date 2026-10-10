import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EchoDialog } from "./echo-dialog";

describe("EchoDialog", () => {
  it("covers the app shell while preserving scroll and close behavior", () => {
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
    expect(document.body.style.overflow).toBe("");
  });
});
