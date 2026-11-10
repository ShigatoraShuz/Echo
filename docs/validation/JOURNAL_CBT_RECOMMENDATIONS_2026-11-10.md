# Journal CBT recommendations — 2026-11-10

## Delivered

- Journal v3 analysis now requests two practical next steps from the same reviewed Buddy CBT inference path. No new model, adapter, dependency, base allocation, or fine-tuning change.
- The prompt includes the journal as quoted data and the saved relative emotion signal, and asks for optional, non-diagnostic actions. It does not reinterpret PHQ scores as a diagnosis.
- The optional saved `cbtRecommendation` contains reviewed text and model provenance, or an explicit unavailable/support-required status. Legacy saved results remain readable without invented recommendations.
- Shared premium Suggested next steps panel appears in both journal report views. Existing AI-care notice remains. Safety flags route to support instead of routine advice.
- Generation failures preserve other analysis results; ownership/cancellation propagate. The existing atomic journal edit invalidation removes the whole old report, including its recommendations, before fresh analysis.
- Existing encrypted analysis storage retains the new field; no database schema change required.

## Verification

- Python recommendation/optional-screening/worker/transport/shared-model/lifecycle regression suite: 66 passed.
- Frontend report suites: 16 passed. Backend worker/routes/availability/edit suites: 28 passed, followed by 13 worker tests including an added v3 recommendation encryption round-trip case.
- Frontend and backend type checks, changed frontend lint, shared contracts build, production frontend build: passed.
- Actual local `/v2/analyze` call using synthetic presentation-anxiety text: HTTP 200; real emotion output, available PHQ journal screening, available recommendation from `buddy-mixed-epochs-2`; final recommendation 801 characters and accepted by the exact backend result contract.
- Final full analysis after restart took 110.255 seconds, including emotion/PHQ and model preparation. A separate warm CBT recommendation call took 9.5 seconds. These are single smoke measurements, not latency guarantees.
- Initial prompt produced an overly long introduction and incomplete advice. Replaced it with an explicit numbered-action request to use the existing Buddy step-output review. Retested with actual inference; two concrete actions were present.
- Private HTTPS login and `/api/v1/health/ready`: HTTP 200 after restart. Tailscale Serve retained.

## Limits

- Browser control is disabled in Work settings, so no interactive save-click, screenshot, visual animation, or real-user journal-edit-to-new-recommendation claim is made in this validation.
- The synthetic model call did not insert or change a user's journal. Encryption persistence and existing edit invalidation were covered by automated tests, not a new live UI save.
- Recommendations are AI support suggestions, not clinically validated treatment or a substitute for professional care. Unavailable results are explicitly labeled.
