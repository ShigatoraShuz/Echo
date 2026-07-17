import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ThemeProvider } from "@/shared/theme";
import { ECHO_THEME_STORAGE_KEY } from "@/lib/theme";
import { SmoothScrollProvider } from "@/shared/components/providers/smooth-scroll-provider";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECHO",
  description: "Private journaling, reflective support, and wellbeing signals. Not a diagnostic tool.",
  icons: {
    icon: "/icon.svg",
  },
};

const echoSans = Manrope({
  subsets: ["latin"],
  variable: "--font-echo-sans",
  display: "swap",
