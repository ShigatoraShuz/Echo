import type { ReactNode } from "react";
import { PublicShell } from "@/shared/components/layout/echo-shells";
import { SmoothScrollProvider } from "@/shared/components/providers/smooth-scroll-provider";
import { EchoPageFade } from "@/shared/components/react-bits/echo-page-fade";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <SmoothScrollProvider><PublicShell><EchoPageFade>{children}</EchoPageFade></PublicShell></SmoothScrollProvider>;
}
