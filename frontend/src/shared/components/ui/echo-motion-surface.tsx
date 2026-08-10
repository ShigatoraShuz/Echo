"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type MotionSurfaceElement = "section" | "article" | "div";

interface EchoMotionSurfaceProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
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

  const resetTilt = React.useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.style.setProperty(
      "--echo-card-transform",
      "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)",
    );
    surface.style.setProperty("--echo-card-glare-opacity", "0");
  }, []);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerMove?.(event);
      if (!tilt || event.pointerType === "touch") return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const surface = surfaceRef.current;
      if (!surface) return;

      const rect = surface.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      const rotateX = (0.5 - y) * 4.2;
      const rotateY = (x - 0.5) * 4.8;

      surface.style.setProperty(
        "--echo-card-transform",
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`,
      );
      surface.style.setProperty("--echo-card-glare-x", `${(x * 100).toFixed(1)}%`);
      surface.style.setProperty("--echo-card-glare-y", `${(y * 100).toFixed(1)}%`);
      surface.style.setProperty("--echo-card-glare-opacity", "1");
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
      "--echo-card-entry-delay": `${Math.max(0, entryDelay)}ms`,
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
