# Core model integration validation — 30 October 2026

Implemented locally with Thesis2_VENV and the copied XLM-R V2, E4-C, and selected
CBT base/adapter. Neither guard model is installed into CODEX/models.

## Artifacts and environment

- 31 inference files copied to `E:\Python Project\CODEX\models`, approximately
  17.97 GB. Every copied file was verified against its source SHA-256 checksum.
- Models, chat template, tokenizers, calibration, and vendored inference code are
  checked at runtime. Model loading is explicitly offline and uses only copied paths.
- Original model artifacts and calibration were preserved.
- The complete Python environment was backed up before installation: 64,192 files,
  zero failed copies, approximately 9.94 GiB. The original package list and copy log
  remain under `CODEX/integration-backup`.
- Missing service/development dependencies were installed into Thesis2_VENV.
  `pycparser` and `hf-xet` inconsistencies were resolved. `pip check` reports no
  broken requirements. Existing GPU model package versions were preserved.
- The exact resulting package set is recorded in `ai-service/requirements-local.lock`.

## Automated results

| Check | Result |
|---|---|
| Frontend suite | 119 files, 540 tests passed |
| Backend suite | 72 files, 383 tests passed |
| Python unit tests | 13 passed |
| Frontend/backend type checks | Passed |
| Backend build | Passed |
| Frontend production build | Passed with synthetic public configuration in an isolated output folder |
| TypeScript lint | No errors; existing warnings remain |
| Changed Python runtime/worker checks | Passed Ruff checks |
| Migration chain and isolated SQL suites | Passed in disposable PostgreSQL/WASM |
| Native result encryption/validation | Passed; severity and screening remain null |
| Camera error and late-permission cleanup | Passed mocked tests |
| Existing v1 compatibility | Existing suites passed |

Python tests emit a Starlette deprecation warning for its HTTPX test transport.
This is not a dependency consistency error.
The frontend build initially could not download the existing Google fonts under
restricted network access; the permitted-network retry passed. Its synthetic
configuration is for build validation, not deployment.

## Actual model execution

The core runtime produced native results for synthetic English, Filipino, and
Taglish text. No research transcripts, dataset rows, or private journals were used.

The explicit HTTP test started the real FastAPI service with a fresh writable cache,
loaded and validated all three copied models serially, and used the actual backend
CoreClient. Missing authorization returned 401; empty analysis input returned 422.
Native analysis and a full selected-policy Buddy response both succeeded.

Measured on the RTX 5070 Ti:

| Measurement | Result from the recorded HTTP run |
|---|---|
| Peak allocated GPU memory | 6,283,582,464 bytes, approximately 5.85 GiB |
| Resident model count | 1 |
| Analysis request | Approximately 5.1 seconds |
| Buddy request | Approximately 26.2 seconds |

These are smoke measurements, not latency guarantees. Loading switches are
intentional. The selected conversational policy's quality checks are heuristic;
successful generation is not clinical or multilingual validation.

## Disposable database execution

The synthetic integration harness creates an isolated PostgreSQL/WASM instance
and applies the entire migration chain. A real Python worker claims its synthetic
job through Express over loopback HTTP, keeps its lease alive, runs copied-model
inference, and submits the actual v2 payload to the real worker callback service.

The harness verified:

- Native output accepted by the shared versioned schema.
- Detailed results persisted only as encrypted ciphertext.
- No clinical severity or inferred PHQ-8 score was inserted.
- Status projection reached completed / 100.
- Existing reviewed recommendation selection and completion transactions ran.

The recorded result and callback trace are stored at
`E:\Python Project\CODEX\integration-backup\disposable-core-result.json`.
The actual HTTP result, model metrics, and synthetic Buddy reply are stored at
`E:\Python Project\CODEX\integration-backup\core-http-result.json`.

This validates the model/HTTP/callback/database path. It does not substitute for
native Supabase Auth/PostgREST/Realtime or authenticated browser testing.

## Rollout status and remaining limits

- No migration or synthetic test record was applied to the connected ECHO project.
- No production deployment or participant rollout was performed.
- The launcher enables journal workers only against a loopback Supabase URL.
- The local environment did not expose Docker/Supabase commands for a full native
  local stack. Native Supabase browser delivery remains unverified.
- Real camera hardware, facial emotion/fusion, inferred screening scores, and guard
  models remain outside this integration.
- Use [the startup guide](local-core-models.md) for the local launcher and rollback
  procedure. Existing development processes were not terminated to replace them
  with the new configuration.
