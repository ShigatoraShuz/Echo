# Local model bundle recovery status

Verified on 2026-11-03. This report describes partial implementation, not completion of the entire recovery plan.

## Completed

- Copied 96 runtime model/reference files, 35,511,537,063 bytes, to ignored Echo/models using staged copy and source/destination hashes. Original assets remain untouched. Inventory is models/bundle.manifest.json.
- Default model paths now use the copied bundle, including exact mixed_epochs_2 adapter/base, Nano/codec, reference and Whisper. Existing interpreter environments are unchanged.
- Vendored pinned Nano inference source and licenses under app/buddy/nano_vendor with source hashes. Runtime no longer imports Nano code from the tester.
- Existing internal formatting.py is byte-identical to the supplied V3 formatter; provenance is recorded separately. No runtime access to the external formatter is needed.
- Added protected draft-free preparation and cached status routes; typing debounce is 750 ms and Talk selection prepares models. No microphone is requested by preparation.
- Chat and Talk join preparation; Stop Talk releases ownership while retaining workers.
- Active manual transcription/read-aloud routes use persistent Whisper/Nano with in-memory decoding/WAV assembly.

## Verified

Backend type check and frontend type check passed before the final provenance-only update. Focused backend: 28 passed. Python Buddy/formatter: 48 passed. Frontend Buddy/view-model: 23 passed.

Real local-bundle CUDA smoke passed: warm-up 130.79 s; minimum global free memory 7868 MiB. CBT, Nano, codec, reference codes stayed CUDA-resident across CBT and Nano operations with stable worker identities; Whisper was CPU INT8. This was a service-component test, not authenticated browser acceptance.

Two copied-manifest corrections were necessary: exclude irrelevant Hugging Face cache metadata, and replace stale adapter inventory entries with independently verified exact two-epoch pins. Shared source manifests and model bytes were not changed.

## Still required

Full per-component progress and unload interface; scheduler handoff during active Talk; complete retirement of dormant legacy speech source and obsolete tests/docs; async JSON repositories, indexing and corrupt-record isolation; deletion fencing; history-store identity; export boundary tests; full product suites/builds; authenticated typing/Chat/Talk/multi-turn browser checks; manual read-aloud/encoded microphone validation; maximum-context/long speech stress and hardware/listening review. Preparation status is coarse and may become stale after scheduler eviction. These limitations must not be presented as completed acceptance.

## Start

From Echo: .\scripts\start-local-core.ps1 -EnableBuddy -LocalJson

Models are inside Echo. Interpreter environments remain external by design. No push or merge performed.
