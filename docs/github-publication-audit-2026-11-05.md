# Publication audit — 2026-11-05

Target: origin/echo-tailscale-remote in ShigatoraShuz/Echo. Remote fetch confirmed local and remote baseline both 403bb60e5a3839817fda699784409d12625cae0b before staging. Publication uses a normal fast-forward push; no main merge, force push or deployment.

## Scope and results

Scanned the complete publishable working-tree inventory, including binary bytes, against eight distinct private configured/active credential values without printing their values. No exact credential-value matches. Patterns checked private keys, common GitHub/OpenAI/Supabase-secret/AWS token formats, credential-bearing URLs, the known private account email and concrete Tailscale hostnames. Eight URL matches were reviewed individually: they are intentional negative/security fixtures using loopback, example or invalid destinations, not real account credentials.

No private .env/runtime config, model bundle, local JSON AI data, Python environment, newly added model/media archive or oversized new file was eligible for publication. Existing tracked binary/public UI assets remain unchanged; the new bundled NotoSans font includes its license. Model assets and the generated reference remain local and ignored. The private Tailscale hostname is absent from source; operators provide remote routing through environment configuration.

The scan covers current files to be committed; the fetched branch has no unpublished prior commits. Already-published baseline history was not re-certified in this audit. Existing screenshots/public assets were not manually reviewed again. This is a publication-focused credential/runtime-data check, not a security certification or proof that all possible secrets or personal information have been detected. No external secret-scanning service received local files.

## Validation and handover

Fresh shared-contract build and workspace frontend/backend type checks passed. Architecture reporting completed; dependency edges remain documented in the handover. Most recent affected speech tests and actual model measurements are in validation/LOCAL_SPEECH_TRANSPORT_2026-11-05.md. No full product-suite, authenticated browser or physical listening acceptance is claimed for this checkpoint.

Current system state, startup command, model/storage boundaries and unfinished acceptance: handover/CURRENT_SYSTEM_2026-11-05.md. A fresh verified source archive is retained only in the sibling Echo-recovery directory. The Git commit and remote branch provide the publishable source checkpoint; they do not contain private runtime files or weights.
