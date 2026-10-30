# Authentication and administrator release checks — 30 October 2026

The release preserves the committed Professional Portal work and the remote navigation performance fix. It adds email-confirmation fragment handling, clearer unconfirmed-email errors, recovery from a failed login redirect, the existing-account Google migration path, and administrator document rescanning with integrity checks. Unrelated uncommitted application and research work is outside this release.

## Local verification

- Frontend: 164 test files, 1,106 tests passed.
- Backend: 113 test files, 903 tests passed; one test skipped.
- Administrator checks cover role bootstrap/grant/revocation, verified-email requirements, password sign-in, MFA, reviewer authorization, rejection of simulated sessions, review/scan errors, and logout.
- Registration/login checks cover eligibility and agreements, password validation and forwarding, confirmation callbacks, invalid and unconfirmed credentials, session persistence, and retry behavior.
- Type checking, lint (existing warnings), production build, route manifest, source/bundle scan, query boundaries, password policy, and isolated SQL security checks passed.
- Runtime and full dependency audits report zero vulnerabilities. Updated Vite/Vitest remain within their existing major versions.
- Archived migration hashes are retained; the manifest test accepts only byte-identical SQL or LF/CRLF equivalents. Migration checkout conversion is disabled to preserve repository bytes.

## Live acceptance still required

Public DNS checks did not find the configured Resend DKIM or sending CNAME records at validation time. Earlier hosted Auth logs reported SMTP rejection because the sender domain was unverified. Real signup confirmation, email-code login, password recovery, and inbox delivery require the domain to show Verified in Resend and a fresh controlled inbox test.

Automated tests do not establish a live administrator password/MFA session or a production deployment. After email delivery is ready, complete signup through ECHO, confirm the email, finish onboarding, sign out, and sign in with the chosen password. Use an assigned reviewer account and its authenticator to verify the administrator workspace.
