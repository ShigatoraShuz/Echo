import { generationStageSchema } from "@echo/contracts";
import type { SharedCbtGenerator } from "./model-service.client.js";
import { AuthorizationError } from "../../shared/errors/app-error.js";
import { assertAiEnabled } from "../security/runtime-controls.js";

/** Explicit local demo responder. Never represents a trained generative model. */
export class GuidedSupportGenerator implements SharedCbtGenerator {
  readonly executionState = "DEMO_FALLBACK" as const;
  constructor(private readonly users: ReadonlySet<string>, private readonly verifyAccess: (userId: string) => Promise<void>) {}
  async generate(userId: string, text: string, context: { role: "user" | "assistant"; content: string }[]) {
    if (!this.users.has(userId)) throw new AuthorizationError("Guided demo is limited to local fictional accounts.");
    await assertAiEnabled();
    await this.verifyAccess(userId);
    let reply: string;
    if (/\b(ground|breathe|coping|exercise)\b/i.test(text)) {
      reply = "If it feels comfortable, notice three things you can see and one sound around you. You can stop whenever you want. Would you like to reflect on what you noticed, or open the Grounding tool?";
    } else if (/\b(journal|reflect|write)\b/i.test(text)) {
      reply = "A reflection prompt: what happened, what did you notice in yourself, and what small support would you like next? You can write privately in Journal, or choose just one part to discuss here.";
    } else if (context.length) {
      reply = "Thank you for sharing. Which would be useful next: a short grounding exercise, a journaling prompt, or naming how today feels? You can also open Find Help to explore human support.";
    } else {
      reply = "We can take this one step at a time. What feels most present today? You can choose a grounding exercise, a journaling prompt, or a mood check-in.";
    }
    await this.verifyAccess(userId);
    return generationStageSchema.parse({
      status: "completed", modelId: "echo-guided-support", modelVersion: "rules-v1",
      executionMode: "synthetic", executionState: "DEMO_FALLBACK", timestamp: new Date().toISOString(),
      durationMs: 0, errorCode: null,
      result: { text: reply, disclaimer: "DEMO_FALLBACK — deterministic prewritten guided support. No LLM, SeaLLMs, diagnosis or therapy." },
    });
  }
}
