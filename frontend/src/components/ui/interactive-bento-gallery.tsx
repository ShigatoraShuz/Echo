"use client";

import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";

export interface BentoMediaItem {
  id: number;
  title: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  href: string;
  span: string;
  priority?: boolean;
}

interface InteractiveBentoGalleryProps {
  mediaItems: BentoMediaItem[];
  eyebrow?: string;
  title: string;
  description: string;
  sectionId?: string;
  className?: string;
}

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(14px) scale(0.97)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px) scale(1)",
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

const sectionTextVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(16px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  },
};

const cardImageVariants: Variants = {
  hidden: { transform: "scale(1.06)" },
  visible: {
    transform: "scale(1)",
    transition: { duration: 0.85, ease: [0.23, 1, 0.32, 1] },
  },
};

const cardTextVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(10px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.45, delay: 0.1, ease: [0.23, 1, 0.32, 1] },
  },
};

function GalleryModal({
  selectedItem,
  mediaItems,
  onSelect,
  onClose,
}: {
  selectedItem: BentoMediaItem;
  mediaItems: BentoMediaItem[];
  onSelect: (item: BentoMediaItem) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center bg-foreground/35 p-3 backdrop-blur-md sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bento-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-soft"
        initial={{ opacity: 0, transform: "scale(0.97) translateY(10px)" }}
        animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
        exit={{ opacity: 0, transform: "scale(0.98) translateY(6px)" }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md transition-[transform,background-color] duration-150 ease-out hover:bg-black/50 focus-visible:ring-4 focus-visible:ring-white/30 active:scale-[0.96]"
          aria-label="Close feature preview"
          autoFocus
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="relative min-h-[330px] flex-1 bg-muted sm:min-h-[520px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedItem.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={selectedItem.url}
                alt={selectedItem.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 960px, 96vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Inside ECHO</p>
                <h3 id="bento-dialog-title" className="mt-2 font-serif text-3xl font-semibold sm:text-5xl">
                  {selectedItem.title}
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                  {selectedItem.description}
                </p>
                <Link
                  href={selectedItem.href}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-transform duration-150 ease-out focus-visible:ring-4 focus-visible:ring-white/30 active:scale-[0.97]"
                >
                  Explore this feature
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-border/70 bg-card p-3 sm:justify-center">
          {mediaItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "relative h-12 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-[transform,border-color] duration-150 ease-out focus-visible:ring-4 focus-visible:ring-ring/20 active:scale-[0.96] sm:h-14 sm:w-20",
                selectedItem.id === item.id ? "border-primary" : "border-transparent",
              )}
              aria-label={`View ${item.title}`}
              aria-pressed={selectedItem.id === item.id}
            >
              <Image src={item.url} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function InteractiveBentoGallery({
  mediaItems,
  eyebrow,
  title,
  description,
  sectionId,
  className,
}: InteractiveBentoGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<BentoMediaItem | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "never"}>
    <section id={sectionId} className={cn("scroll-mt-20 bg-background", className)}>
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24 xl:px-10">
        <motion.div
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-12"
          variants={sectionTextVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          ) : null}
          <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
        </motion.div>

        <motion.div
          className="grid auto-rows-[76px] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4"
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {mediaItems.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              className={cn(
                "group relative min-h-56 overflow-hidden rounded-[1.5rem] border border-border/60 bg-muted text-left shadow-subtle outline-none transition-transform duration-150 ease-out focus-visible:ring-4 focus-visible:ring-ring/30 active:scale-[0.99] sm:min-h-0",
                item.span,
              )}
              variants={cardVariants}
              whileTap={{ transform: "scale(0.99)" }}
              onClick={() => setSelectedItem(item)}
              aria-label={`Open ${item.title} feature preview`}
            >
              <motion.div className="absolute inset-0" variants={cardImageVariants}>
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  className="object-cover transition-transform duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:scale-[1.025]"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  priority={item.priority}
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <motion.div className="absolute inset-x-0 bottom-0 p-5 text-white" variants={cardTextVariants}>
                <h3 className="font-serif text-xl font-semibold sm:text-2xl">{item.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-white/72">{item.description}</p>
              </motion.div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedItem ? (
          <GalleryModal
            selectedItem={selectedItem}
            mediaItems={mediaItems}
            onSelect={setSelectedItem}
            onClose={() => setSelectedItem(null)}
          />
        ) : null}
      </AnimatePresence>
    </section>
    </MotionConfig>
  );
}
