import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EchoMotionSurface } from "./echo-motion-surface";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("draws the latest hover position once per frame and cancels pending work on leave", () => {
  let draw!: FrameRequestCallback;
  const request = vi.fn((callback: FrameRequestCallback) => {
    draw = callback;
    return 7;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: !query.includes("reduced-motion"),
  }));
  const { getByTestId } = render(
    <EchoMotionSurface data-testid="surface">Unchanged card</EchoMotionSurface>,
  );
  const surface = getByTestId("surface");
  const bounds = vi
    .spyOn(surface, "getBoundingClientRect")
    .mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect);
  fireEvent(
    surface,
    new MouseEvent("pointermove", { bubbles: true, clientX: 10, clientY: 20 }),
  );
  fireEvent(
    surface,
    new MouseEvent("pointermove", { bubbles: true, clientX: 80, clientY: 70 }),
  );
  expect(request).toHaveBeenCalledOnce();
  expect(bounds).not.toHaveBeenCalled();
  act(() => draw(16));
  expect(bounds).toHaveBeenCalledOnce();
  expect(surface.style.getPropertyValue("--echo-card-glare-x")).toBe("80.0%");
  expect(surface.style.getPropertyValue("--echo-card-glare-y")).toBe("70.0%");
  fireEvent(
    surface,
    new MouseEvent("pointermove", { bubbles: true, clientX: 20, clientY: 30 }),
  );
  fireEvent.pointerLeave(surface);
  expect(cancel).toHaveBeenCalledWith(7);
  expect(surface.style.getPropertyValue("--echo-card-glare-opacity")).toBe("0");
});
