import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ThemeProvider } from "@/shared/theme";
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
});

const echoDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-echo-display",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The middleware sets the x-nonce request header; Next.js applies it to its
  // own inline bootstrap scripts, which allows a strict script-src without
  // 'unsafe-inline'. Reading headers() also opts every route into dynamic
  // rendering so the per-request nonce reaches the rendered HTML. The theme
  // init script lives in /theme-init.js (allowed by script-src 'self') so no
  // user script carries a nonce attribute, which avoids a hydration mismatch.
  await headers();
  return (
    <html
      lang="en"
      data-echo-theme="echo-calm"
      data-echo-motion={process.env.NODE_ENV === "development" ? "full" : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must block pre-paint to avoid a theme flash */}
        <script src="/theme-init.js" />
      </head>
      <body className={`${echoSans.variable} ${echoDisplay.variable}`} suppressHydrationWarning>
        <SmoothScrollProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
