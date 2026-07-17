import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EchoReveal } from "./echo-reveal";

type ObserverCallback = IntersectionObserverCallback;

class ControlledIntersectionObserver implements IntersectionObserver {
  static callback: ObserverCallback;
  static options: IntersectionObserverInit | undefined;

  readonly root = null;
  readonly rootMargin = "0px 0px -6% 0px";
  readonly thresholds = [0.08];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
  unobserve = vi.fn();

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    ControlledIntersectionObserver.callback = callback;
    ControlledIntersectionObserver.options = options;
  }
}

describe("EchoReveal", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", ControlledIntersectionObserver);
  });

  it("reveals media once with the landing motion defaults", () => {
    render(<EchoReveal variant="media">Feature image</EchoReveal>);

    const reveal = screen.getByText("Feature image");
    expect(reveal).toHaveClass("opacity-0", "translate-y-8", "scale-[0.975]");
    expect(reveal).toHaveStyle({
      transitionDuration: "680ms",
      transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
    expect(ControlledIntersectionObserver.options).toEqual({
      rootMargin: "0px 0px -6% 0px",
      threshold: 0.08,
    });

    act(() => {
      ControlledIntersectionObserver.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(reveal).toHaveClass("opacity-100", "translate-y-0", "scale-100");
  });

  it("uses the shared reduced-motion fallback class", () => {
    render(<EchoReveal variant="card">Feature card</EchoReveal>);

    expect(screen.getByText("Feature card")).toHaveClass("echo-scroll-reveal");
  });
});
