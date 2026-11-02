import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FacialCameraWidget } from "./facial-camera-widget";

afterEach(() => vi.restoreAllMocks());

function cameraStream() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

it("attaches a granted stream and stops its tracks on Stop camera", async () => {
  const { stream, stop } = cameraStream();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const view = render(<FacialCameraWidget />);
  fireEvent.click(screen.getByRole("button", { name: /enable camera/i }));
  await screen.findByRole("button", { name: /stop camera/i });
  expect(view.container.querySelector("video")?.srcObject).toBe(stream);
  fireEvent.click(screen.getByRole("button", { name: /stop camera/i }));
  expect(stop).toHaveBeenCalledOnce();
  view.unmount();
});

it("stops an active stream when the widget unmounts", async () => {
  const { stream, stop } = cameraStream();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const view = render(<FacialCameraWidget />);
  fireEvent.click(screen.getByRole("button", { name: /enable camera/i }));
  await screen.findByRole("button", { name: /stop camera/i });
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it("stops a late permission result after navigation away", async () => {
  const { stream, stop } = cameraStream();
  let grant!: (value: MediaStream) => void;
  const pending = new Promise<MediaStream>((resolve) => { grant = resolve; });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockReturnValue(pending) } });
  const view = render(<FacialCameraWidget />);
  fireEvent.click(screen.getByRole("button", { name: /enable camera/i }));
  view.unmount();
  await act(async () => { grant(stream); await pending; });
  await waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
