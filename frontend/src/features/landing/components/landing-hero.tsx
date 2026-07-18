"use client";

import { MotionConfig, motion, type Variants } from "framer-motion";
import { ShieldCheck, Sparkles, Wind, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import heroBackground from "../../../../assets/aac2846f-fae0-4ae0-a910-a48a0627440f (1).png";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/shared/hooks/use-prefers-reduced-motion";
import type { LandingHeroContent, LandingStatIcon } from "../model";

interface LandingHeroProps {
  content: LandingHeroContent;
  className?: string;
}
