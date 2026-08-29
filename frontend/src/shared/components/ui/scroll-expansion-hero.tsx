"use client";

import { useRef, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { EchoReveal } from "@/shared/components/react-bits/echo-reveal";

interface ScrollExpandMediaProps {
  mediaSrc: string | StaticImageData;
  title: string;
  eyebrow?: string;
  scrollToExpand?: string;
  children?: ReactNode;
}

export function ScrollExpandMedia({
  mediaSrc,
  title,
  eyebrow,
  scrollToExpand,
  children,
}: ScrollExpandMediaProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const mediaWidth = useTransform(scrollYProgress, [0.12, 0.58], ["46%", "86%"]);
  const mediaHeight = useTransform(scrollYProgress, [0.12, 0.58], ["19rem", "31rem"]);
  const mediaY = useTransform(scrollYProgress, [0.12, 0.58], [44, 0]);
  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_14%_8%,rgba(218,233,220,0.92),transparent_35%),radial-gradient(circle_at_88%_10%,rgba(237,224,187,0.72),transparent_36%),linear-gradient(135deg,#faf7ef_0%,#edf4ed_49%,#dceae5_100%)] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true">
        <div className="absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-[#c6ddc5]/45 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#a7c9d2]/35 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl">
        <EchoReveal variant="text" direction="none" className="mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#536733]">{eyebrow}</p>
          ) : null}
          <h2 className="mt-3 font-[family-name:var(--font-echo-display)] text-3xl font-medium leading-tight tracking-[-0.035em] text-[#2f3527] sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          {scrollToExpand ? (
            <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-[#5f6857]">{scrollToExpand}</p>
          ) : null}
        </EchoReveal>

        <motion.div
          className="mx-auto mt-10 overflow-hidden rounded-[2rem] border border-[#536733]/12 bg-[#fffdf7] p-2 shadow-[0_28px_70px_rgba(23,45,37,0.14)]"
          style={{ width: mediaWidth, height: mediaHeight, y: mediaY, maxWidth: "100%" }}
        >
          <div className="relative h-full overflow-hidden rounded-[1.45rem]">
            <Image src={mediaSrc} alt={title} fill sizes="(min-width: 1024px) 72vw, 94vw" className="object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(13,33,26,0.2))]" />
          </div>
        </motion.div>

        {children ? <div className="mx-auto mt-10 max-w-5xl">{children}</div> : null}
      </div>
    </section>
  );
}

export default ScrollExpandMedia;
