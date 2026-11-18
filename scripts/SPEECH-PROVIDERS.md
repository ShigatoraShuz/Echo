# Speech recognition

Journal dictation and Buddy voice offer **Whisper** (default, processed on the Echo host) and **Browser speech · no API key**. Browser speech uses `SpeechRecognition` or `webkitSpeechRecognition`; unavailable browsers show the option disabled with Whisper still available. No Google Cloud credentials, billing account, or downloaded Echo model is required for Browser speech. This is a browser service, not a guaranteed Google provider or unlimited-service contract.

Browser speech is English-only in Echo. Audio may be sent to the browser provider's servers, as disclosed beside the selector. Echo receives only finalized text and does not upload or store browser-recognition audio. Recognition is limited to 59 seconds and 4,000 characters per recording/turn. Whisper retains its existing encoded-audio path.

Journal browser dictation appends final text to the current draft and preserves typing and overflow recovery. It does not run analysis automatically. Buddy recorded speech enters the usual chat path. Live Talk uses a session-pinned `browser` provider and authenticated `transcript` WebSocket events containing the existing turn ID/generation and bounded user text. Server ownership, consent, authorization, safety, generation, approved-reply speech, and history behavior remain in place. Audio-only jobs accept Whisper; browser text cannot masquerade as approved Buddy output.

Recognition stops on cancellation, navigation, conversation/entry change, backgrounding live Talk, and unmount. Live Talk stops recognition while thinking or playing MOSS audio and resumes after completion. A recognition error or empty ending pauses Talk and requires **Resume Talk**; it never silently switches providers or restarts endlessly. User-selected Whisper remains available on retry.

Serve the app over HTTPS (including the Tailscale HTTPS link) or localhost, and allow microphone access. A physical microphone/browser check is needed for actual recognition availability and audio quality. Automated doubles validate event and capture lifetimes, not a browser vendor's recognition service.

The previous Google Cloud Speech-to-Text integration and its dedicated authentication dependency were removed. Existing Google sign-in is unaffected.

Performance: journal analysis reuses its existing full safety classification for the same text, avoiding one duplicate classifier pass. PHQ8 agreement checks remain enabled. Expressive MOSS still starts its native executable per speech segment; persistent weight residency needs a separately validated native worker change. No unmeasured MOSS speed improvement is claimed.

References: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition and https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api
