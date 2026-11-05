/** Never display arbitrary model/transport responses or exception messages. */
export function speechErrorMessage(code: unknown): string {
  if (typeof code !== 'string') return 'Local speech is unavailable. Your approved answer is retained; retry speech.';
  if (code === 'AI_TRANSPORT_AUTH_FAILED') return 'The private speech connection could not authenticate. Restart Echo using one coordinated launcher.';
  if (code === 'AI_TRANSPORT_RATE_LIMITED') return 'The local speech service is busy with requests. Wait briefly, then retry speech.';
  if (code === 'AI_TRANSPORT_UNAVAILABLE') return 'The local speech runtime is unavailable. Your approved answer is retained; retry speech after recovery.';
  if (code === 'AI_TRANSPORT_CONNECTION_FAILED') return 'Cannot connect to the local speech service. Check that Echo is running.';
  if (code === 'BUDDY_CANCELLED') return 'Speech was cancelled.';
  if (code === 'AI_TRANSPORT_TIMEOUT' || /^BUDDY_(CBT|NANO|WHISPER)_(LOAD|ENV)_TIMEOUT$/.test(code)) return 'Local model preparation or speech timed out. Your approved answer is retained; retry speech.';
  if (/^BUDDY_NANO_[A-Z_]{1,60}$/.test(code)) return 'Nano speech preparation or synthesis failed (' + code + '). Your approved answer is retained; retry speech.';
  return 'Local speech is unavailable. Your approved answer is retained; retry speech.';
}
