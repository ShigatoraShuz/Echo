# Analysis contract (legacy filename)

This filename is retained so historical links do not break. ECHO no longer has a mock-analysis provider or marker syntax.

The current path is `Journal/API -> Analysis Service -> ML Service -> Recommendation Service`. Analysis Service persists orchestration state and returns the canonical API envelope. ML Service owns model loading, PHQ-8 severity mapping for inference output, and the independent urgent-language safety signal.

No validated model loader or artifact/evaluation manifest is present. Therefore `/v1/infer` intentionally returns 503, Analysis Service maps that to `ML_INFERENCE_UNAVAILABLE`, and the journal UI reports that validated analysis is currently unavailable. Ordinary journaling, drafts, mood check-ins, Buddy, grounding, dashboard, and emotion insights remain available.

See `packages/contracts/src/analysis.ts` and `docs/api.yaml` for the current transport contracts.
