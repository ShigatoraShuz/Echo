# AI/ML integration boundary

The boundary is now implemented as separate services:

`Gateway -> Analysis Service -> Journal/User/ML/Recommendation services`

Analysis Service owns consent/verification orchestration and analysis records. ML Service exclusively owns loading a reviewed model runtime and producing structured inference. Recommendation Service converts validated severity/safety fields into non-diagnostic support guidance.

Plaintext journal content may cross only the authenticated Journal-to-Analysis-to-ML internal path, must never be logged, and must retain the same UUID request ID. Structured output is validated before persistence. Dependency failures use controlled error envelopes.

The current ML runtime is deliberately not ready: repository code contains no validated loader, artifacts, or clinical evaluation manifest. `/health` is a liveness probe, `/health/ready` returns 503, and `/v1/infer` returns 503. Do not replace this with fabricated scores or a mock provider. A future validated loader belongs only in `ml/app/runtime.py` and requires artifact checksums, evaluation evidence, and security/clinical review.
