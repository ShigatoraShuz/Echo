# Buddy speech preparation reliability

The supplied logs showed five `prepare` failures in 7–14 ms, each mapped to `AI_TRANSPORT_UNAVAILABLE`. Those historical entries do not preserve HTTP status, so they cannot distinguish a rejected request from an unavailable runtime.

## Behavior

- Private transport logs preserve HTTP status and sanitized cause codes without request text or raw response bodies. Invalid speech requests, ambiguous expressions, incomplete coverage, expired Talk ownership, missing endpoints/assets, busy workers, and transport failures remain distinguishable.
- Approved text is normalized before segmentation. Markdown markers are removed, item order is retained, supported numbers become words, and valid duration ranges including `2–5-minute` become spoken ranges. Ambiguous dates, signed values, currency, and similar expressions remain explicit preparation failures rather than silently losing content.
- The prepared parts must reconstruct the entire normalized reply. Nano text segmentation failures preserve the healthy worker and produce a stable error code.
- Automatic retry is limited to transient connection, busy-worker, and timeout failures, with five total attempts. Permanent input/asset/authentication and malformed audio failures stop immediately. Manual Retry speech warms the voice session and reuses the approved reply without invoking CBT again.
- Retried audio delivery resets playback generation when audio was already sent, avoiding stale sequence acknowledgements and overlapping playback.
- The voice interface distinguishes Preparing speech, Generating audio, and Ready to listen. Microphone capture resumes only after local playback has finished and the server has confirmed turn completion. A delivery-metadata storage failure no longer prevents turn completion.

## Verification

- Focused Python speech/runtime tests: 42 passed.
- Backend transport and realtime Talk tests: 62 passed.
- Frontend capture, voice UI, and speech-error tests: 35 passed.
- Frontend/backend type checks and policy integrity verification passed.
- Tests include Markdown/numbers/ranges, ten-item coverage, ambiguous text, permanent/transient retry counts, retained approved replies, both completion-event orders, and consecutive turns even if playback metadata cannot be saved.
- The coordinated `npm run dev:buddy` launcher was started with the existing environments. Local AI, backend, and frontend reported startup ready.
- The opt-in synthetic Nano/Whisper hardware check is provided by `scripts/check-speech-preparation.py`; its successful report is saved to the ignored `runtime-cache/buddy-audit/speech-preparation-check.json`. This tests generated PCM and ASR agreement, not microphone operation or subjective listening quality.
- Real Nano/Whisper check passed: ordinary reply, 2 segments / 5.92 seconds, ASR token agreement 0.88; ten-item reply, 10 segments / 41.76 seconds, agreement 0.9694. Both retained complete normalized text coverage. The test's owned Nano/Whisper workers were released on completion; no voice provider fallback was used.

CBT generation policy, counselor guidance, model weights, and audio limits are unchanged by these speech changes. No remote push is part of this work.
