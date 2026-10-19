import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EchoIntroGate } from "./echo-intro-gate";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

vi.mock("./echo-app-intro", () => ({
  EchoAppIntro: () => <div>Opening ECHO</div>,
}));

describe("EchoIntroGate", () => {
  beforeEach(() => {
    route.pathname = "/";
    document.documentElement.removeAttribute("data-echo-intro");
    window.localStorage.clear();
  });

  it("renders crisis support immediately for a first-time visitor", () => {
    route.pathname = "/crisis";

    render(
      <EchoIntroGate>
        <main>Immediate crisis support</main>
      </EchoIntroGate>,
    );

    expect(screen.getByText("Immediate crisis support")).toBeVisible();
    expect(screen.queryByText("Opening ECHO")).not.toBeInTheDocument();
  });

  it("renders a direct public link without the landing intro", () => {
    route.pathname = "/about";

    render(
      <EchoIntroGate>
        <main>About ECHO</main>
      </EchoIntroGate>,
    );

    expect(screen.getByText("About ECHO")).toBeVisible();
    expect(screen.queryByText("Opening ECHO")).not.toBeInTheDocument();
  });
});
