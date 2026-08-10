"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type ArcGalleryHeroProps = {
  images: string[];
  startAngle?: number;
  endAngle?: number;
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
  className?: string;
  background?: ReactNode;
  children?: ReactNode;
};

type GalleryBreakpoint = "lg" | "md" | "sm";

type GalleryDimensions = {
  radius: number;
  cardSize: number;
  imageLimit: number;
};

function getBreakpoint(width: number): GalleryBreakpoint {
  if (width < 640) return "sm";
  if (width < 1024) return "md";
  return "lg";
}

export function getGalleryDimensions(
  width: number,
  {
    radiusLg,
    radiusMd,
    radiusSm,
    cardSizeLg,
    cardSizeMd,
    cardSizeSm,
  }: Pick<
    Required<ArcGalleryHeroProps>,
    "radiusLg" | "radiusMd" | "radiusSm" | "cardSizeLg" | "cardSizeMd" | "cardSizeSm"
  >,
): GalleryDimensions {
  switch (getBreakpoint(width)) {
    case "sm":
      return { radius: radiusSm, cardSize: cardSizeSm, imageLimit: 8 };
    case "md":
      return { radius: radiusMd, cardSize: cardSizeMd, imageLimit: 10 };
    default:
      return { radius: radiusLg, cardSize: cardSizeLg, imageLimit: Number.POSITIVE_INFINITY };
  }
}

function canApplyPointerTilt(event: PointerEvent<HTMLElement>) {
  return (
    event.pointerType === "mouse" &&
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function handleHeroTiltMove(event: PointerEvent<HTMLElement>) {
  if (!canApplyPointerTilt(event)) return;

  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;

  target.dataset.tilting = "true";
  target.style.setProperty("--echo-tilt-x", `${(0.5 - y) * 5}deg`);
  target.style.setProperty("--echo-tilt-y", `${(x - 0.5) * 5}deg`);
  target.style.setProperty("--echo-glare-x", `${x * 100}%`);
  target.style.setProperty("--echo-glare-y", `${y * 100}%`);
}

export function resetHeroTilt(event: PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  delete target.dataset.tilting;
  target.style.removeProperty("--echo-tilt-x");
  target.style.removeProperty("--echo-tilt-y");
  target.style.removeProperty("--echo-glare-x");
  target.style.removeProperty("--echo-glare-y");
}

export function ArcGalleryHero({
  images,
  startAngle = 20,
  endAngle = 160,
  radiusLg = 510,
  radiusMd = 350,
  radiusSm = 170,
  cardSizeLg = 88,
  cardSizeMd = 74,
  cardSizeSm = 52,
  className,
  background,
  children,
}: ArcGalleryHeroProps) {
  const [dimensions, setDimensions] = useState<GalleryDimensions>(() =>
    getGalleryDimensions(1024, {
      radiusLg,
      radiusMd,
      radiusSm,
      cardSizeLg,
      cardSizeMd,
      cardSizeSm,
    }),
  );

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions(
        getGalleryDimensions(window.innerWidth, {
          radiusLg,
          radiusMd,
          radiusSm,
          cardSizeLg,
          cardSizeMd,
          cardSizeSm,
        }),
      );
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  const visibleImages = useMemo(
    () => images.slice(0, dimensions.imageLimit),
    [dimensions.imageLimit, images],
  );
  const count = Math.max(visibleImages.length, 2);
  const step = (endAngle - startAngle) / (count - 1);

  return (
    <section
      className={cn(
        "relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-[var(--landing-mist)] text-[var(--landing-ink)]",
        className,
      )}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {background}
        </div>
      ) : null}

      <div
        className="pointer-events-none relative z-[1] mx-auto w-full pt-20 sm:pt-0"
        aria-hidden="true"
        style={{ height: dimensions.radius * 1.25 }}
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-20 sm:translate-y-0">
          {visibleImages.map((src, index) => {
            const angle = startAngle + step * index;
            const angleInRadians = (angle * Math.PI) / 180;
            const x = Math.cos(angleInRadians) * dimensions.radius;
            const y = Math.sin(angleInRadians) * dimensions.radius;
            const cardStyle = {
              width: dimensions.cardSize,
              height: dimensions.cardSize,
              left: `calc(50% + ${x}px)`,
              bottom: `${y}px`,
              zIndex: count - index,
              "--echo-arc-delay": `${index * 80}ms`,
              "--echo-arc-rotation": `${angle / 5}deg`,
            } as CSSProperties;

            return (
              <div key={src} className="echo-arc-gallery__card absolute" style={cardStyle}>
                <div
                  className="echo-arc-gallery__tilt pointer-events-auto h-full w-full"
                  onPointerMove={handleHeroTiltMove}
                  onPointerLeave={resetHeroTilt}
                >
                  {/* The gallery is decorative; the semantic hero copy remains the accessible entry point. */}
                  <Image
                    src={src}
                    alt=""
                    width={dimensions.cardSize}
                    height={dimensions.cardSize}
                    sizes={`${dimensions.cardSize}px`}
                    priority={index === 0 || index === 4 || index === 5}
                    className="block h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {children ? <div className="relative z-10 -mt-30 flex flex-1 items-start justify-center sm:-mt-44 lg:-mt-80">{children}</div> : null}
    </section>
  );
}
