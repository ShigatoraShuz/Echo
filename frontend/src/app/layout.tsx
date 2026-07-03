import type { Metadata } from "next";
import { ThemeProvider } from "@/components/echo/theme-provider";
import { ECHO_THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECHO",
  description: "Private journaling, reflective support, and wellbeing signals. Not a diagnostic tool.",
  icons: {
    icon: "/icon.svg",
  },
};

const themeInitScript = `
(function() {
  try {
    var key = ${JSON.stringify(ECHO_THEME_STORAGE_KEY)};
    var stored = window.localStorage.getItem(key);
    var parsed = stored ? JSON.parse(stored) : {};
    var variants = ["echo-calm", "echo-night", "echo-soft", "echo-focus"];
    var modes = ["light", "dark", "system"];
    var variant = variants.indexOf(parsed.variant) >= 0 ? parsed.variant : "echo-calm";
    var mode = modes.indexOf(parsed.mode) >= 0 ? parsed.mode : "light";
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    var root = document.documentElement;
    root.dataset.echoTheme = variant;
    root.dataset.echoMode = mode;
    root.classList.toggle("dark", resolvedMode === "dark" || variant === "echo-night");
  } catch (error) {
    document.documentElement.dataset.echoTheme = "echo-calm";
    document.documentElement.dataset.echoMode = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-echo-theme="echo-calm" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
