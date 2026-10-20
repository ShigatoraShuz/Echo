import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProfessionalPreview } from "@/features/professionals/dev/professional-preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local professional preview — ECHO", robots: { index: false, follow: false } };

export default async function ProfessionalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const host = (await headers()).get("host");
  let local = false;
  try {
    const url = new URL(`http://${host}`);
    local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    // Missing or malformed hosts must fail closed.
  }
  if (!local) notFound();

  return <ProfessionalPreview />;
}
