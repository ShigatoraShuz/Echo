/** Never display arbitrary model/transport responses or exception messages. */
export function speechErrorMessage(code: unknown): string {
  if (typeof code !== 'string') return 'Local speech is unavailable. Your approved answer is retained; retry speech.';
  if (code === 'BUDDY_SPEECH_TEXT_AMBIGUOUS' || code === 'BUDDY_SPEECH_REQUEST_INVALID') return 'Speech could not prepare an expression in this reply. The full text is retained. Retry speech or continue in Chat.';
  if (code === 'BUDDY_SPEECH_COVERAGE_FAILED') return 'Speech could not preserve the complete reply. The full text is retained; retry speech.';
  if (code === 'BUDDY_SPEECH_SEGMENT_INVALID') return 'Speech could not split this reply into supported audio segments. The full text is retained; retry speech.';
  if (code === 'BUDDY_SPEECH_ENDPOINT_MISSING') return 'The speech endpoint is missing. Restart Echo using the coordinated launcher, then retry speech.';
  if (code === 'BUDDY_TALK_NOT_ACTIVE') return 'The voice session has expired. Your approved reply is retained; retry speech to restore the session.';
  if (code === 'AI_TRANSPORT_AUTH_FAILED') return 'The private speech connection could not authenticate. Restart Echo using one coordinated launcher.';
  if (code === 'AI_TRANSPORT_RATE_LIMITED') return 'The local speech service is busy with requests. Wait briefly, then retry speech.';
  if (code === 'AI_TRANSPORT_UNAVAILABLE') return 'The local speech runtime is unavailable. Your approved answer is retained; retry speech after recovery.';
  if (code === 'AI_TRANSPORT_CONNECTION_FAILED') return 'Cannot connect to the local speech service. Check that Echo is running.';
  if (code === 'BUDDY_CANCELLED') return 'Speech was cancelled.';
  if (code === 'AI_TRANSPORT_TIMEOUT' || /^BUDDY_(CBT|NANO|WHISPER)_(LOAD|ENV)_TIMEOUT$/.test(code) || /^BUDDY_MOSS_[A-Z_]*TIMEOUT$/.test(code)) return 'Local model preparation or speech timed out. Your approved answer is retained; retry speech.';
  if (code === 'BUDDY_MOSS_ASSET_MISSING') return 'MOSS v1.5 is not installed on the server (BUDDY_MOSS_ASSET_MISSING). Your approved answer is retained; restore MOSS and retry speech.';
  if (/^BUDDY_(?:NANO|MOSS|WHISPER)_.*ASSET.*$/.test(code) || /^BUDDY_(?:NANO|MOSS|WHISPER)_(?:ENV_UNAVAILABLE|ENV_IMPORT_FAILED|PACKAGE_UNAVAILABLE)$/.test(code)) return 'Speech model files or dependencies are missing. Restore the configured voice environment, then retry speech. Your approved reply is retained.';
  if (/^BUDDY_MOSS_NATIVE_EXIT_[A-F0-9]{8}$/.test(code)) return 'Expressive speech stopped with native code ' + code.slice(-8) + '. Your approved answer is retained; retry speech after recovery.';
  if (/^BUDDY_MOSS_[A-Z_]{1,60}$/.test(code)) return 'Expressive speech preparation or synthesis failed (' + code + '). Your approved answer is retained; retry speech.';
  if (/^BUDDY_NANO_[A-Z_]{1,60}$/.test(code)) return 'Nano speech preparation or synthesis failed (' + code + '). Your approved answer is retained; retry speech.';
  return 'Local speech is unavailable. Your approved answer is retained; retry speech.';
}
