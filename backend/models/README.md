# Local research checkpoints

## Current application and standalone tooling

Root `npm run dev` starts Next.js and Express only. It does not start model inference
or apply `.local/active.json`. The root `models:*` and `dev:stop` npm aliases shown in
the historical workflow below are no longer defined.

The retained standalone manager can instead be invoked from the repository root:

```powershell
npx --no-install tsx backend/scripts/models.mts list
```

Its other subcommands are `scan`, `validate`, `status`, `activate` and `prepare`.
`list` may rebuild the hash cache; `scan` can create manifests; `activate` changes
local selection state; `status` may contact the authenticated loopback model service.
These commands are separate from ordinary application startup. Keep standalone
runtime configuration and authorization checks intact; selecting a model does not
reconnect it to the restored application.

## Historical model-supervisor workflow

The following instructions describe the retired supervisor integration. They retain
its export contracts and standalone selection/recovery semantics; its npm aliases,
automatic startup and runtime-status claims do not describe current `npm run dev`.

```powershell
npm run dev
npm run models:list
npm run models:scan
npm run models:validate
npm run models:status
```

Copy a complete compatible export into a NEW folder here. Both CBT_Final/ and existing cbt/version/ layouts work. Folder names do not establish a task or clinical validity. Dot directories, archives, conversion sources, temporary/incomplete directories, symlinks and junctions are excluded.

Scan imports recognized manifest-less exports and reports precise missing requirements for other candidates. Import creates only a new manifest.json with actual hashes, architecture, task, tokenizer, bounded preprocessing, dependency ranges, provenance and engineering readiness. Existing manifests and models are never overwritten.

List uses a stat-bound hash cache for large unchanged artifacts; small metadata is always hashed. Validate freshly checks hashes, tensor coverage, tokenizer/spec and dependencies. Blocked unselected exports are reported separately; an invalid active selection fails the command. Scan/list alone do not establish a learned-weight forward pass.

## Supported exports

- Full Qwen2 CBT: audited CPU/BF16 architecture, unsharded model.safetensors, config, generation config, fast tokenizer, chat template and reviewed inference-spec.json (echo-qwen-cbt-inference-v1). Tensor coverage, tied embeddings, RoPE, token IDs, prompt and generation bounds are checked. A generic base without the supported CBT recipe is blocked. No external weights are downloaded.
- Generic RoBERTa: standard RobertaForSequenceClassification safetensors with exact labels/tokenizer and the small researcher declaration below. Its supported aggregation is mean probabilities. It never replaces XLM-R's mean-logit/calibration recipe.
- Existing Echo manifests: preserved. E4 and calibrated XLM-R require their existing reviewed architecture-specific inference/calibration contracts. PEFT requires the exact matching local base, tokenizer and verified CUDA. Discovery cannot invent missing research specifications.
- Diagnostic bundles: existing diagnostic-manifest.json remains distinct from calibrated classification. Current XLM-R raw output can be selected as researchDiagnostic. E4 encoder/head diagnostics cannot be activated as full classification.

For a standard RoBERTa export, supply echo-export.json before scanning:

```json
{
  "model_id": "researcher-reviewed-emotion-export",
  "version": "initial-v2",
  "task": "peak",
  "source": "Matching training export or researcher-confirmed reference",
  "max_tokens": 256,
  "normalization": "identity",
  "semantics": "sigmoid"
}
```

Supply the ACTUAL task, preprocessing and activation semantics. This example is not a recipe for an unknown checkpoint. The legacy peak key does not establish PEAK research identity. Distress requires exactly five checkpoint-defined labels and supported semantics. Unverified calibration is blocked. Custom E4 pooling/activation/windowing requires the existing reviewed research-export contract. Model ID/version are optional for supported imports; otherwise the new folder supplies a local identity/version, never a research-validation claim. Researcher metadata is hashed with the bundle.

Qwen imports preserve their existing reviewed inference recipe and fictional-local provenance scope. Standard local development enforces the same safety restriction. Manifest generation is engineering bookkeeping, not a signature, research approval or training-reference parity.

## Select and roll back

```powershell
npm run dev:stop
npm run models:activate -- --task cbt --model CBT_DropIn_Verification
npm run dev
# Stop before restoring the previous complete selection:
npm run dev:stop
npm run models:activate -- --rollback
npm run dev
```

Use your own installed folder or exact model_id@version. Activation rehashes selected artifacts, checks duplicate identities and adapter prerequisites, atomically saves current/previous selections and refuses while application ports are listening. Concurrent activation is locked. After a CLI crash, inspect that no activation process remains before removing its activation.lock; never remove model files to resolve it.

backend/models/.local/active.json is the single local source of truth. It persists across restarts. Legacy selections are adopted once only. Startup freshly verifies selected artifacts; catalog cache cannot authorize activation. Status queries the actual authenticated loopback registry and shows listening/runtime state. Weights load lazily: validated_not_loaded is not an inference success claim. There is no browser manager API or public hot reload.

Keep versions immutable. Install final exports beside initial ones, scan, validate, stop, activate and restart. Historic encrypted results retain their original model ID/version. Provisional models are forbidden for participants and production.

Current Qwen produces real text; XLM-R produces raw uncalibrated logits. E4 still needs exact pooling/activation/preprocessing. PHQ-8 lacks its matching local SEA-LION/DAIC base and CUDA. Face remains blocked pending a safe supported export and preprocessing contract. No pickle or remote model code is executed. Original archives and versions remain untouched.

See [startup prerequisites](../../docs/LOCAL-MODEL-CONSULTATION.md) and [research export contracts](../../artifacts/model-integration/MODEL-EXPORT-CONTRACTS.md).
