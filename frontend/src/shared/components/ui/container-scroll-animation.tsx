"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

export function ContainerScroll({
  titleComponent,
  children,
  className = "",
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode | ((scrollYProgress: MotionValue<number>) => React.ReactNode);
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const rotate = useTransform(scrollYProgress, [0, 0.82], isMobile ? [12, 0] : [34, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.82], isMobile ? [0.72, 0.96] : [0.7, 1]);
  const translate = useTransform(scrollYProgress, [0, 0.82], [42, -96]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0]);

  return (
    <div
      ref={containerRef}
      className={`relative h-[145vh] overflow-visible p-2 md:h-[180vh] md:p-20 ${className}`}
    >
      <div className="sticky top-0 flex min-h-screen w-full items-center justify-center py-10 md:py-16" style={{ perspective: "1200px" }}>
        <div className="w-full">
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {typeof children === "function" ? children(scrollYProgress) : children}
        </Card>
        <motion.p
          style={{ opacity: cueOpacity }}
          className="mx-auto mt-6 w-fit rounded-full border border-[#536733]/15 bg-[#fffdf7]/80 px-4 py-2 text-xs font-bold text-[#536733] shadow-subtle backdrop-blur-sm"
        >
          Scroll to bring ECHO forward
        </motion.p>
        </div>
      </div>
    </div>
  );
}

export function Header({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: string | React.ReactNode;
}) {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  );
}

export function Card({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      data-container-scroll-card
      style={{
        rotateX: rotate,
        scale,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
        boxShadow:
          "0 0 #00000024, 0 9px 20px #0d211a24, 0 37px 37px #0d211a1f, 0 84px 50px #0d211a14, 0 149px 60px #0d211a08, 0 233px 65px #0d211a03",
      }}
      className="mx-auto -mt-12 h-[30rem] w-full max-w-5xl rounded-[30px] border-4 border-[#1f2d28] bg-[#1f2724] p-2 shadow-2xl md:h-[40rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-[#fcfaf6] md:rounded-2xl">
        {children}
      </div>
    </motion.div>
  );
}
