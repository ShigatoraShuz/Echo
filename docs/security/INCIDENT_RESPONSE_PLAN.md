# Incident response and recovery

Review: 2026-09-18. Draft runbook; owner assignment, approval and tabletop are pending. No incident/restore drill was performed.

The release owner must assign an incident commander, security investigator, platform operator, privacy lead and communications approver, with an out-of-band contact directory. Missing on-call ownership blocks production.

1. Detect and triage: correlate request IDs, event codes, actor hashes and time ranges. Preserve a restricted append-only copy of audit evidence and deployment/migration hashes. Do not copy journal content or tokens into tickets.
2. Contain: atomically replace the configured ECHO_SECURITY_CONTROLS_FILE with validated controls disabling AI/uploads and affected route prefixes. Invalid/unreadable configured controls fail closed. No file means the runtime control overlay is disabled; production must explicitly configure it. backend/security-controls.example.json is a safe starting point.
3. Revoke access: use the managed Auth global sign-out for the compromised identity/session, disable the account and remove compromised reviewer assignment using an approved admin operation. Verify existing access tokens are denied by security_session_active; expiration alone is insufficient. Never paste access tokens in shell history.
4. Rotate credentials: inventory affected backend/service-role, AI, scanner, CI and encryption secrets. Replace only through the approved platform secret manager; revoke old credentials, test affected integrations and inspect access logs. Encryption rotation follows ENCRYPTION_AND_KEY_MANAGEMENT.md. Live rotation requires explicit authorization.
5. Investigate: determine first/last access, affected owners/categories, export or provider disclosure, integrity impact and backup exposure. Preserve provenance and access controls on evidence.
6. Recover: forward-fix code/config, restore only in an isolated project, replay deletion tombstones, verify RLS/grants and cross-user tests, then restore service gradually with monitoring.
7. Communicate: privacy/legal lead determines applicable notification obligations and recipients. No automated external messages are authorized by this runbook.
8. Review: document root cause, scope, timing, containment evidence, residual risk and corrective owners/dates; hold a tabletop after changes.

## Alert wiring specification

External collector rules must aggregate metadata-only events and route to the named on-call owner: authentication/authorization failures >=10 per actor or trusted IP within 5 minutes; rate denials >=20/5 minutes; exports >=3 per actor/hour; any privileged-role/key/config change; scanner unavailable/rejected spikes; audit delivery failure immediately; AI daily budget >=80% warning and >=100% halt. Baselines and thresholds require load testing. Current audit middleware instruments failures and selected workflows; durable collector delivery, some key/config events and AI budget measurements are incomplete. Do not claim alerts active.

## Backup and restore

Production requires encrypted database AND object backups with separate least-privilege restoration credentials, independently protected key versions, monitored job success and an approved retention window. Proposed RPO 24 hours/RTO 8 hours and 35-day maximum backup retention require owner approval.

Quarterly restore exercise: select synthetic/approved backup; create isolated project with outbound AI/mail disabled; verify target and key versions; restore schemas/data/objects without production credentials; apply pending forward migrations; replay deletion ledger; test sample decryptions, RLS two-user denial, storage access, login revocation and export/deletion isolation; record timings/counts/hashes and securely expire the temporary environment after separate approval. Never restore production data into routine development. No remote reset is permitted.

## Ongoing release requirements

Require reviewed PRs and passing type/lint/test/build/SQL/secret/dependency checks on protected branches; protected production environment approval; contents:read PR tokens and no production secrets in previews. GitHub settings require repository administrator action. Critical exposed vulnerabilities: immediate triage/containment, fix target 24 hours; high: 7 days; moderate: 30 days; low: 90 days, with signed time-bounded exceptions. Review dependencies weekly, privileged access quarterly, restoration quarterly and independent assessment annually/before real-user launch. No exceptions are accepted by this document.
