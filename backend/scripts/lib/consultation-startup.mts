import { createServer } from "node:net";

export const consultationPorts = [3000, 4300, 8100] as const;

/** Never kill an existing app or silently choose another frontend port. */
export async function assertConsultationPortsAvailable(ports: readonly number[] = consultationPorts) {
  for (const port of ports) {
    await new Promise<void>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", () => reject(new Error(`Port ${port} is occupied. Stop that app explicitly before starting the local consultation; no process was killed.`)));
      probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => probe.close(error => error ? reject(error) : resolve()));
    });
  }
}

export function consultationSelection(value: unknown) {
  const config = value as { schemaVersion?: string; researchDiagnostic?: string; cbtGeneration?: string } | null;
  const identity = /^[A-Za-z0-9._/-]+@[A-Za-z0-9._-]+$/;
  if (config?.schemaVersion !== "echo-consultation-selection-v1" ||
      typeof config.researchDiagnostic !== "string" || !identity.test(config.researchDiagnostic) ||
      typeof config.cbtGeneration !== "string" || !identity.test(config.cbtGeneration)) {
    throw new Error("Real consultation requires explicit valid classifier and generation identities; no guided substitution.");
  }
  return { researchDiagnostic: config.researchDiagnostic, cbtGeneration: config.cbtGeneration };
}

export async function waitForConsultation(check: () => Promise<boolean>, timeoutMs = 180_000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error("Local consultation did not become ready. Inspect the local runtime log; no cloud fallback was enabled.");
}
