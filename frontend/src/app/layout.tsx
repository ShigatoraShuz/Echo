import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";

import { ThemeProvider } from "@/shared/theme";
import { EchoIntroGate } from "@/shared/components/branding/echo-intro-gate";

import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECHO",
  description:
    "Private journaling, reflective support, and wellbeing signals. Not a diagnostic tool.",
  icons: {
    icon: "/icon.svg",
    apple: "/echo-icon-192.png",
  },
  appleWebApp: { capable: true, title: "ECHO", statusBarStyle: "default" },
};

const echoSans = localFont({
  src: "./fonts/Manrope-Latin.woff2",
  weight: "200 800",
  variable:
    "--font-echo-sans",
  display: "swap",
});

const echoDisplay =
  localFont({
    src: "./fonts/CormorantGaramond-Latin.woff2",
    weight: "400 600",
    variable:
      "--font-echo-display",
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must block pre-paint to avoid a theme flash */}
        <script src="/theme-init.js" />

        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run before body paint so returning sessions never flash the intro */}
        <script src="/intro-init.js" />
      </head>

      <body
        className={`${echoSans.variable} ${echoDisplay.variable}`}
        suppressHydrationWarning
      >
        <EchoIntroGate>
          <ThemeProvider>{children}</ThemeProvider>
        </EchoIntroGate>
      </body>
    </html>
  );
}
