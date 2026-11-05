# EchoFace v4 connection — 2026-11-04

The active text-memory AI runtime now serves the existing protected /v1/face interface through models/face_model. Both TextRuntime and the alternate CoreRuntime face method use the same in-memory CPU worker; active inference no longer writes image/request/output payload files.

The exact v4 runtime, selected_model.joblib, metadata, landmark asset and requirements are pinned in app/model/face-package.lock.json and checked before loading the trusted local joblib artifact. The local models manifest also inventories this package. Weights and captures remain excluded from Git.

The interpreter defaults to CODEX/face-venv/Scripts/python.exe. FACE_PYTHON can select an existing compatible environment; no environment was installed or changed. Missing/corrupt assets or worker failures produce an unavailable service response. No older face model is substituted.

Captures use bounded base64 input (2 MiB decoded), a bounded one-at-a-time subprocess, a 90-second execution timeout, isolated Python startup, credential-free child environment, CPU execution, owned-process cleanup and a 64 KiB result limit. Captures pass only over stdin. The backend continues to check account ownership, journal/facial consent, journal completion and support pauses; only validated expression results are stored in local JSON. Facial output remains experimental and uncalibrated; it does not establish a diagnosis or change text screening.

Validation: package hashes and existing environment imports passed; actual package/landmarker loading on a synthetic blank image returned no_usable_face in 9.12 seconds. No physical webcam or real-person expression accuracy test was performed. Existing journal completion/Talk waiting behavior remains in force for automatic capture processing.

Restart the normal launcher to activate the new runtime. Enable journal analysis and facial-analysis consent, then use the journal camera capture flow. Captures already discarded by a previous failure must be retaken; they are not recoverable from history.
