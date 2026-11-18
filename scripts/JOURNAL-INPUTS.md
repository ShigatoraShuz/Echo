# Journal dictation and analysis display

The journal Dictate button offers local Whisper (default) and explicitly selected
Browser speech English transcription. See `SPEECH-PROVIDERS.md` for browser support
and the audio disclosure. It prepares on demand, records up to 59 seconds, and appends to
the latest body. Canceling or leaving the editor stops the microphone and job.
Audio is volatile and is never added to journal storage. The journal's normal
draft autosave applies to inserted text. Oversized transcripts remain available
for copying without replacing the body.

Deep analysis is a display-only switch that starts OFF for each opened entry.
The journal PHQ8 meter stays visible; switching ON adds distress categories and
relative scores. The dashboard continues to show self-reported check-ins.
Partial journal estimates highlight possible PHQ8 bands, calculated from the
known subtotal through subtotal plus three per missing item. No value is imputed
for missing criteria and no exact needle is shown for a partial estimate.

Private deployments set `ECHO_PRIVATE_FACE_ENABLED=true` through the private
launcher. Face inference still verifies its pinned package and requires journal
and facial-analysis consent. Live expression processing can take longer than
landmark tracking, especially on cold start. Retry expression analysis keeps the
camera active. Failed optional face saving does not undo a saved reflection;
the editor retains its transient frame for the face-only retry until reset or
navigation. No raw face image is added by this change to persistent storage.

To run generated-audio and blank-frame runtime checks without a microphone,
camera, Buddy activation, or database writes:

```powershell
& 'E:\Python Project\PROJECTS\Thesis2\Thesis2_VENV\python.exe' -B scripts/validate-journal-inputs.py
```

The ignored report is `runtime-cache/buddy-audit/journal-input-validation.json`.
It tests real Whisper, silence, cancellation, authenticated private HTTP dispatch,
face-package readiness, rejection of a blank frame, a positive expression result
from the bundled Matplotlib portrait fixture when available, and worker release. A physical
camera check is still required for real-world expression quality.

The full private launcher additionally requires the existing machine-local
`backend/.local-development/native-runtime.json` with the approved project,
explicit account UUIDs, and stable activation timestamp. Dictation itself does
not require Buddy consent or journal-analysis opt-in, but still requires verified
access and honors the global AI control.

# Local face environment

`models/face_model` contains the approved v4 package. Its six files match the supplied Thesis2 `FACE/final model with ineference/model-final/model` folder byte for byte. Echo uses its own copy, so it needs no external model junction.

Run `scripts/setup-face-local.ps1` to create or repair `ai-service/.venv-face` with the existing Thesis2 Python and pinned `ai-service/requirements-face.lock`. It installs only into the local environment. A previous junction is removed without touching its target. The Buddy setup also invokes this step. A real portrait and blank-image inference passed after the local environment was rebuilt.

