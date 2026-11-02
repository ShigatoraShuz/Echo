"use client";

import * as React from "react";

import { cn } from "@/shared/lib/utils";
import { shouldReduceMotion } from "@/shared/hooks/use-prefers-reduced-motion";

type MotionSurfaceElement = "section" | "article" | "div";

interface EchoMotionSurfaceProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "children"
> {
  as?: MotionSurfaceElement;
  children: React.ReactNode;
  entryDelay?: number;
  tilt?: boolean;
}

type MotionSurfaceStyle = React.CSSProperties & {
  "--echo-card-entry-delay"?: string;
};

export function EchoMotionSurface({
  as = "section",
  children,
  className,
  entryDelay = 0,
  tilt = true,
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: EchoMotionSurfaceProps) {
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const frame = React.useRef<number | null>(null);
  const pointer = React.useRef({ x: 0, y: 0 });
  const cancelFrame = React.useCallback(() => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  React.useEffect(() => cancelFrame, [cancelFrame]);

  const resetTilt = React.useCallback(() => {
    cancelFrame();
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.style.setProperty(
      "--echo-card-transform",
      "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)",
    );
    surface.style.setProperty("--echo-card-glare-opacity", "0");
  }, [cancelFrame]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerMove?.(event);
      if (!tilt || event.pointerType === "touch") return;
      if (
        typeof window.matchMedia !== "function" ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches
      )
        return;
      if (shouldReduceMotion()) return;

      const surface = surfaceRef.current;
      if (!surface) return;

      pointer.current = { x: event.clientX, y: event.clientY };
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const rect = surface.getBoundingClientRect();
        const x = Math.min(
          1,
          Math.max(0, (pointer.current.x - rect.left) / rect.width),
        );
        const y = Math.min(
          1,
          Math.max(0, (pointer.current.y - rect.top) / rect.height),
        );
        const rotateX = (0.5 - y) * 4.2;
        const rotateY = (x - 0.5) * 4.8;

        surface.style.setProperty(
          "--echo-card-transform",
          `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`,
        );
        surface.style.setProperty(
          "--echo-card-glare-x",
          `${(x * 100).toFixed(1)}%`,
        );
        surface.style.setProperty(
          "--echo-card-glare-y",
          `${(y * 100).toFixed(1)}%`,
        );
        surface.style.setProperty("--echo-card-glare-opacity", "1");
      });
    },
    [onPointerMove, tilt],
  );

  const handlePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerLeave?.(event);
      resetTilt();
    },
    [onPointerLeave, resetTilt],
  );

  const sharedProps = {
    ...props,
    ref: (node: HTMLElement | null) => {
      surfaceRef.current = node;
    },
    className: cn("echo-motion-card", className),
    "data-tilt": tilt ? "true" : "false",
    style: {
      ...style,
      ...(entryDelay > 0
        ? { "--echo-card-entry-delay": `${entryDelay}ms` }
        : {}),
    } as MotionSurfaceStyle,
    onPointerMove: handlePointerMove,
    onPointerLeave: handlePointerLeave,
  };

  if (as === "article") {
    return <article {...sharedProps}>{children}</article>;
  }

  if (as === "div") {
    return <div {...sharedProps}>{children}</div>;
  }

  return <section {...sharedProps}>{children}</section>;
}
