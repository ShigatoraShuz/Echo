import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { professionalPreviewExit } from "@/features/professionals/dev/professional-preview-navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Local professional preview — ECHO", robots: { index: false, follow: false } };

export default async function ProfessionalPreviewPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ view?: string; returnOrganization?: string }> }) {
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

  // Keep the fixture graph behind the compile-time development branch.
  if (process.env.NODE_ENV === "development") {
    const params = await searchParams;
    if (params.view === "lab") {
      const { ProfessionalPreview } = await import("@/features/professionals/dev/professional-preview");
      return <><div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 text-xs"><strong>Demo Preview — Fictional Data · Component laboratory</strong><a href={"/dev/professional-preview" + (params.returnOrganization ? "?returnOrganization=" + encodeURIComponent(params.returnOrganization) : "")} className="inline-flex min-h-11 items-center text-primary underline">Clinician workspace</a><a href={professionalPreviewExit(params.returnOrganization)} className="inline-flex min-h-11 items-center text-primary underline">Exit Preview</a></div><ProfessionalPreview /></>;
    }
    const { ProfessionalClinicianPreview } = await import("@/features/professionals/dev/professional-clinician-preview");
    return <ProfessionalClinicianPreview />;
  }
  notFound();
}
