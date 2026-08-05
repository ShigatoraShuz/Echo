# Future AI integration boundary

The current non-AI phase uses `AnalysisProvider` in `backend/src/infrastructure/analysis`. Its mock implementation accepts explicit development markers only, such as `[MOCK:SCORE=12]`; it does not infer or diagnose from journal prose.

Later, replace `MockAnalysisProvider` with `FastApiAnalysisProvider` implementing the same `analyze`, `healthCheck`, and `getProviderInfo` methods. The adapter may use `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, and a timeout only when a validated model and security review are available. Controllers, journal services, repositories, frontend services, and API DTOs must remain unchanged.

The future adapter must send plaintext only over its authenticated internal channel, never log it, validate structured output, preserve request IDs, map failures to safe codes, and never present a score as a diagnosis.
