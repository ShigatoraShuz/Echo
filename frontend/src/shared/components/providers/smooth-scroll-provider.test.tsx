import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SmoothScrollProvider } from "./smooth-scroll-provider";

const { renderLenis, useReducedMotion } = vi.hoisted(() => ({
  renderLenis: vi.fn(),
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

describe("SmoothScrollProvider", () => {
  beforeEach(() => {
    renderLenis.mockClear();
