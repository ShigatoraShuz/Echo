import { render, act, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { InterfaceSoundController } from "./interface-sound-controller";
import { playInterfaceSound, stopInterfaceSound } from "@/services/audio/interface-sound";
let path = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
vi.mock("@/services/audio/interface-sound", () => ({
  INTERFACE_SOUND_EVENT: "echo:interface-sounds-changed",
  INTERFACE_SOUND_KEY: "echo:interface-sounds",
  interfaceSoundPreference: () => ({ enabled: true, volume: 0.35 }),
  playInterfaceSound: vi.fn(),
  stopInterfaceSound: vi.fn(),
  unlockInterfaceSound: vi.fn(),
}));
beforeEach(() => {
  path = "/dashboard";
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{ width: 200 }] as unknown as DOMRectList);
});
afterEach(() => cleanup());
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 45));
  });
it("skips initial routes and detects each navigation once", () => {
  const view = render(<InterfaceSoundController />);
  expect(playInterfaceSound).not.toHaveBeenCalled();
  path = "/journal";
  view.rerender(<InterfaceSoundController />);
  view.rerender(<InterfaceSoundController />);
  expect(playInterfaceSound).toHaveBeenCalledExactlyOnceWith("page");
});
it("sounds for switching an existing in-page tab but not its initial render", async () => {
  const view = render(
    <>
      <InterfaceSoundController />
      <button role="tab" aria-selected="true">
        First
      </button>
      <button role="tab" aria-selected="false">
        Second
      </button>
    </>,
  );
  await flush();
  expect(playInterfaceSound).not.toHaveBeenCalled();
  view.rerender(
    <>
      <InterfaceSoundController />
      <button role="tab" aria-selected="false">
        First
      </button>
      <button role="tab" aria-selected="true">
        Second
      </button>
    </>,
  );
  await flush();
  expect(playInterfaceSound).toHaveBeenCalledExactlyOnceWith("page");
});
it("announces opening and reopening, never closing or ordinary popup updates", async () => {
  const view = render(
    <>
      <InterfaceSoundController />
      <div role="dialog" aria-hidden="true">
        Existing
      </div>
    </>,
  );
  view.rerender(
    <>
      <InterfaceSoundController />
      <div role="dialog">Open</div>
    </>,
  );
  await flush();
  expect(playInterfaceSound).toHaveBeenCalledExactlyOnceWith("popup");
  view.rerender(
    <>
      <InterfaceSoundController />
      <div role="dialog">Updated</div>
    </>,
  );
  await flush();
  expect(playInterfaceSound).toHaveBeenCalledTimes(1);
  view.rerender(
    <>
      <InterfaceSoundController />
      <div role="dialog" aria-hidden="true">
        Closing
      </div>
    </>,
  );
  await flush();
  expect(playInterfaceSound).toHaveBeenCalledTimes(1);
  view.rerender(
    <>
      <InterfaceSoundController />
      <div role="dialog">Reopened</div>
    </>,
  );
  await flush();
  expect(playInterfaceSound).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new Event("echo:sensitive-state-cleared"));
  expect(stopInterfaceSound).toHaveBeenCalled();
});
