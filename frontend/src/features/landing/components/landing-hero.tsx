"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import heroBackground from "../../../../assets/aac2846f-fae0-4ae0-a910-a48a0627440f (1).png";
import sereneCloudRoom from "../../../../assets/landing-page/774cbe149f698999c49f28a20cab1061.jpg";
import familyAtHome from "../../../../assets/landing-page/image 1.jpg";
import lookingSkyward from "../../../../assets/landing-page/image 2.jpg";
import joyfulPortrait from "../../../../assets/landing-page/image 3.jpg";
import reflectionDesk from "../../../../assets/landing-page/image 10.jpg";
import livingRoomPortrait from "../../../../assets/landing-page/image 11.jpg";
import sunlitPortrait from "../../../../assets/landing-page/image 12.jpg";
import plantPortrait from "../../../../assets/landing-page/image 13.jpg";
import coffeePortrait from "../../../../assets/landing-page/image 14.jpg";
import travelReflection from "../../../../assets/landing-page/image 5.jpg";
import phoneReflection from "../../../../assets/landing-page/image 6.jpg";
import couchReflection from "../../../../assets/landing-page/image 7.jpg";
import laptopReflection from "../../../../assets/landing-page/image 8.jpg";
import deskReflection from "../../../../assets/landing-page/image 9.jpg";
import yellowCoatPortrait from "../../../../assets/landing-page/iamge 4.jpg";
import { cn } from "@/shared/lib/utils";
import {
  ArcGalleryHero,
  handleHeroTiltMove,
  resetHeroTilt,
} from "@/shared/components/ui/arc-gallery-hero-component";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import type { LandingHeroContent } from "../model";

interface LandingHeroProps {
  content: LandingHeroContent;
  className?: string;
}

function getLocalImageSrc(image: string | { src: string }) {
  return typeof image === "string" ? image : image.src;
}

export const HERO_GALLERY_IMAGES = [
  getLocalImageSrc(lookingSkyward),
  getLocalImageSrc(joyfulPortrait),
  getLocalImageSrc(yellowCoatPortrait),
  getLocalImageSrc(travelReflection),
  getLocalImageSrc(couchReflection),
  getLocalImageSrc(livingRoomPortrait),
  getLocalImageSrc(sunlitPortrait),
  getLocalImageSrc(coffeePortrait),
  getLocalImageSrc(plantPortrait),
  getLocalImageSrc(phoneReflection),
  getLocalImageSrc(laptopReflection),
  getLocalImageSrc(deskReflection),
  getLocalImageSrc(reflectionDesk),
  getLocalImageSrc(familyAtHome),
  getLocalImageSrc(sereneCloudRoom),
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.08, staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

const titleVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(105%)" },
  visible: {
    opacity: 1,
    transform: "translateY(0%)",
    transition: { duration: 0.72, ease: [0.23, 1, 0.32, 1] },
  },
};

export function LandingHero({
  content: { eyebrow, title, subtitle, actions },
  className,
}: LandingHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
      <ArcGalleryHero
        className={cn(
          "relative z-50 bg-[var(--landing-mist)] text-[var(--landing-ink)]",
          className,
        )}
        images={HERO_GALLERY_IMAGES}
        background={
          <>
            <Image
              src={heroBackground}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(242,245,241,0.14)_0%,rgba(240,244,241,0.3)_52%,rgba(240,244,241,0.58)_100%)]" />
          </>
        }
      >
        <motion.div
          className="mx-auto flex w-full max-w-[1440px] flex-col items-center px-5 pb-10 pt-8 text-center [font-family:var(--font-echo-sans)] sm:px-8 sm:pb-12 sm:pt-10 lg:px-12 lg:pt-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {eyebrow ? (
            <motion.p
              className="inline-flex rounded-full bg-[var(--landing-primary)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--landing-inverse)] shadow-sm sm:text-xs"
              variants={itemVariants}
            >
              {eyebrow}
            </motion.p>
          ) : null}

          <motion.div className="mt-2 w-full overflow-hidden pb-2" variants={itemVariants}>
            <motion.h1
              className="mx-auto max-w-[1220px] text-[clamp(3.5rem,8vw,8.4rem)] font-medium leading-[0.84] tracking-[-0.055em] text-[var(--landing-primary)] [font-family:var(--font-echo-display)] [text-wrap:balance]"
              variants={titleVariants}
            >
              {title}
            </motion.h1>
          </motion.div>

          <motion.p
            className="mt-5 max-w-2xl text-sm font-medium leading-6 text-[var(--landing-ink)] sm:text-[15px] sm:leading-6"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          <motion.div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row" variants={itemVariants}>
            {actions.map((action) => {
              const primary = action.variant === "primary";

              return (
                <span
                  key={action.href}
                  className="echo-hero-tilt inline-flex rounded-full"
                  onPointerMove={handleHeroTiltMove}
                  onPointerLeave={resetHeroTilt}
                >
                  <Link
                    href={action.href}
                    className={cn(
                      "relative z-10 inline-flex min-h-12 min-w-48 items-center justify-center rounded-full px-6 text-sm font-bold outline-none transition-[transform,background-color,border-color] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-[var(--landing-primary-25)] active:scale-[0.97]",
                      primary
                        ? "bg-[var(--landing-primary)] text-[var(--landing-inverse)] hover:bg-[var(--landing-primary-hover)]"
                        : "border border-[var(--landing-primary-45)] bg-[var(--landing-cream-35)] text-[var(--landing-primary)] backdrop-blur-sm hover:bg-[var(--landing-cream-65)]",
                    )}
                  >
                    {action.text}
                  </Link>
                </span>
              );
            })}
          </motion.div>

        </motion.div>
      </ArcGalleryHero>
    </MotionConfig>
  );
}
