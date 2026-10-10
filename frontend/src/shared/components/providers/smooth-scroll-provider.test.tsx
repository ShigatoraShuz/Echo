import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SmoothScrollProvider } from "./smooth-scroll-provider";

const { renderLenis, route, useReducedMotion } = vi.hoisted(() => ({
  renderLenis: vi.fn(),
  route: { pathname: "/" },
  useReducedMotion: vi.fn(),
}));

vi.mock("lenis/react", () => ({
  ReactLenis: ({ children, ...props }: { children: ReactNode }) => {
    renderLenis(props);
    return <div data-testid="lenis-root">{children}</div>;
  },
}));

vi.mock("@/shared/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: useReducedMotion,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

describe("SmoothScrollProvider", () => {
  beforeEach(() => {
    renderLenis.mockClear();
    route.pathname = "/";
    useReducedMotion.mockReturnValue(false);
  });

  it("enables a global Lenis instance with smooth anchors", () => {
    render(
      <SmoothScrollProvider>
        <main>Page content</main>
      </SmoothScrollProvider>,
    );

    expect(screen.getByTestId("lenis-root")).toBeInTheDocument();
    expect(renderLenis).toHaveBeenCalledWith({
      root: true,
      options: expect.objectContaining({
        anchors: true,
        autoRaf: true,
        smoothWheel: true,
        stopInertiaOnNavigate: true,
      }),
    });
  });

  it("uses native scrolling when reduced motion is requested", () => {
    useReducedMotion.mockReturnValue(true);

    render(
      <SmoothScrollProvider>
        <main>Page content</main>
      </SmoothScrollProvider>,
    );

    expect(screen.queryByTestId("lenis-root")).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeVisible();
  });

  it("uses native scrolling for the crisis route", () => {
    route.pathname = "/crisis";

    render(
      <SmoothScrollProvider>
        <main>Immediate crisis support</main>
      </SmoothScrollProvider>,
    );

    expect(screen.queryByTestId("lenis-root")).not.toBeInTheDocument();
    expect(screen.getByText("Immediate crisis support")).toBeVisible();
  });
});
