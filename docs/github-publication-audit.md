# Publication audit â€” 2026-11-04

Target: origin/echo-tailscale-remote. No force push or main-branch merge.

## Checks

- Scanned 4,284 branch-history/index blobs, including binary blobs, against six locally configured private credential values: no matches. Values were never printed or included here.
- Pattern scan covered 4,280 text-sized history/index objects for private keys, common provider tokens, service-role JWTs, credential URLs, secret literals, and the known private account email. Matches were reviewed as test fixtures, placeholder documentation, route names, or environment references; no confirmed credential findings.
- No local JSON history, runtime credential file, Python environment, model weights, or generated Buddy reference is tracked in the current index.
- Removed models.zip from the index before commit; archive remains local. Added model-archive ignore rules.
- Replaced the concrete remote hostname in Next.js config with a hostname derived from the operator-provided ECHO_REMOTE_API_BASE_URL. No operator-specific hostname is required in source.
- Existing versioned UI sounds, public face/runtime assets, and the baseline QA screenshot archive remain unchanged. These are not new uploads in this update; screenshot contents were not manually reviewed.

This is a publication-focused credential/private-runtime-data audit, not a security certification, full penetration test, or proof that every historical screenshot/document is free of personal information. Regex scanning cannot prove the absence of all possible secrets.

## Remote development

Set ECHO_REMOTE_API_BASE_URL to your own HTTPS frontend origin plus /api/v1 in the launcher shell. Do not commit a private .env file. The Next.js API rewrite forwards to loopback Express; AI traffic remains internal. The server gateway URL remains loopback.

## Validation before publication

- Frontend TypeScript check and launcher JavaScript syntax check passed.
- 42 Buddy/text-transport tests passed.
- Every staged V3/Nano source file matches its existing SHA-256 pin.
- Whitespace checking with original CRLF recognized reports three upstream README trailing-space lines; left unchanged to preserve the pinned upstream bytes.
