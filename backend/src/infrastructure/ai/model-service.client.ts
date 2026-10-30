import { generationStageSchema, modelPipelineResultSchema, type GenerationStage } from "@echo/contracts";
import { ExternalServiceError, AuthorizationError } from "../../shared/errors/app-error.js";
import { assertAiEnabled } from "../security/runtime-controls.js";

export interface SharedCbtGenerator {
  readonly executionState?: "DEMO_FALLBACK";
  generate(
    userId: string,
    text: string,
    context: { role: "user" | "assistant"; content: string }[],
  ): Promise<GenerationStage>;
}

/** Fixed internal destination. Does not relax the public outbound request policy. */
export class ModelServiceClient implements SharedCbtGenerator {
  constructor(
    private readonly origin: string,
    private readonly token: string,
    private readonly users: ReadonlySet<string>,
    private readonly timeoutMs: number,
    private readonly expectedMode: "real" | "synthetic",
    private readonly verifyGenerationAccess?: (userId: string) => Promise<void>,
    private readonly verifyAnalysisAccess?: (userId: string) => Promise<void>,
    private readonly allowResearchDiagnostic = false,
  ) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.username ||
      url.password ||
      token.length < 32 ||
      !users.size
    )
      throw new Error("An explicit loopback model service, secret, and engineering account scope are required.");
  }
  private async request(path: string, input: unknown) {
    await assertAiEnabled();
    try {
      const response = await fetch(`${this.origin}/engineering/v2/${path}`, {
        method: "POST",
        redirect: "error",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) throw new Error("MODEL_SERVICE_UNAVAILABLE");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("MODEL_SERVICE_EMPTY");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 256_000) throw new Error("MODEL_OUTPUT_TOO_LARGE");
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new ExternalServiceError(
        "MODEL_UNAVAILABLE",
        "Trained model generation or analysis is unavailable. Please try later; your journal is safe.",
      );
    }
  }
  private authorize(userId: string) {
    if (!this.users.has(userId)) throw new AuthorizationError("Models are restricted to local engineering accounts.");
  }
  async analyze(userId: string, text: string) {
    this.authorize(userId);
    await this.verifyAnalysisAccess?.(userId);
    const result = modelPipelineResultSchema.parse(await this.request("analyze", { text }));
    if (result.researchDiagnostic && (!this.allowResearchDiagnostic || this.expectedMode !== "real"))
      throw new AuthorizationError("Research diagnostics require explicit isolated consultation mode.");
    await this.verifyAnalysisAccess?.(userId);
    if (result.isSimulated !== (this.expectedMode === "synthetic")) throw new Error("MODEL_EXECUTION_MODE_MISMATCH");
    return result;
  }
  async generate(userId: string, text: string, context: { role: "user" | "assistant"; content: string }[]) {
    this.authorize(userId);
    await this.verifyGenerationAccess?.(userId);
    const result = generationStageSchema.parse(await this.request("generate", { text, context: context.slice(-6) }));
    if (result.executionMode !== this.expectedMode || result.status !== "completed" || !result.result)
      throw new ExternalServiceError("MODEL_UNAVAILABLE", "Trained model generation is unavailable.");
    await assertAiEnabled();
    await this.verifyGenerationAccess?.(userId);
    return result;
  }
}
