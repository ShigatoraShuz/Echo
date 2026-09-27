# Encryption and key management

Review: 2026-09-21. Implementation: backend/src/infrastructure/encryption/encryption.service.ts.

AES-256-GCM uses a new 12-byte cryptographically random IV for every write, a 16-byte authentication tag and a versioned 32-byte key. Decryption validates canonical base64, lengths and approved key versions and rejects authentication failures. Keys are process configuration outside the ciphertext database. They are never browser configuration. New writes use JOURNAL_ENCRYPTION_KEY_VERSION; ENCRYPTION_PREVIOUS_KEYS_JSON maps approved previous versions to distinct keys. Secret values are not included in this document.

| Store | Format / status |
| --- | --- |
| Journal title/body and drafts | Existing ciphertext + IV + tag + key-version columns; plaintext title sentinel |
| Buddy message content | echo:encrypted:v1: envelope containing versioned AES-GCM payload; no plaintext read fallback |
| Verification designated fields | Existing encrypted payload columns; inventory in service and catalog |
| New detailed AI results | result_payload contains only an AES-GCM text envelope; old plaintext results require approved backfill before encrypted-only reads |
| Temporary exports | Whole account package encrypted before database persistence; owner/request binding checked after authenticated decryption; 24-hour expiry and single-use consumption |
| PHQ-8 assessments | New responses, score and severity encrypted together with owner/submission binding; server recomputes score after decryption; historical migration/rotation helper defaults to local-only dry run |
| Safety severity index, journal metadata and historical projections | Plaintext coverage remains incomplete; release blocker |
| Object storage | Private access is not application-level encryption; scanner/deployment encryption configuration remains unverified |

Rotation procedure (not exercised against remote data):

1. Assign change owner; disable writes/AI using runtime controls; verify authorized environment. Take an approved encrypted backup and test key access without printing keys.
2. Generate a fresh independent 32-byte key through the approved secret manager. Add the former key under its previous version and activate the new version. Never reuse bytes under another version.
3. Verify new synthetic writes carry the new version and both versions decrypt. Crypto tests cover this contract; production KMS is not implemented.
4. Re-encrypt in bounded batches with compare-and-swap on record version/ciphertext. Keep plaintext only in memory; log counts and opaque receipt IDs, never content. Resume safely after interruption.
5. Verify coverage and tamper rejection; reconcile every database/object/provider location. Do not remove old keys while records or unexpired backups need them.
6. Record owner approval, coverage, restore compatibility and retirement date. A compromised key cannot be made safe merely by re-encrypting records already exfiltrated; follow incident response.

Legacy Buddy plaintext must be backfilled before the encrypted-only reader is released against existing data. NOT VALID database constraints preserve historical rows but enforce new writes; they do not prove backfill completion. Existing journal backfill is restricted to a disposable local database. No backfill or live key rotation was run in this task.

Plaintext lifetime: decrypt only within authorized request/worker memory; prohibit persistent temp files, caches, prompts in logs and analytics. JavaScript strings cannot guarantee zeroization; do not claim memory erasure. Managed KMS/secret-store access, rotation automation and full Restricted-field coverage remain required.

Account export artifacts use the same versioned backend keyring, not a browser key. No plaintext archive is written to disk, object storage or logs. The authorized download returns plaintext over the authenticated HTTPS API; no signed public URL is issued. See EXPORT_COVERAGE.md for limits and exclusions.

PHQ-8 migration sequence: apply the forward schema migration in reviewed non-production first; run `backend/scripts/wellness-ciphertext-backfill.mts` against disposable local synthetic data (dry-run default; `--apply-synthetic` opt-in). The helper refuses remote URLs, validates old scores and owner/submission binding, decrypts approved old keys, round-trips new ciphertext, and compares all original values before clearing plaintext. Counts report unreadable records and conflicts; any such count exits nonzero. It was tested through synthetic stores and isolated SQL, not run against any live database. Historical PHQ-8 rows must be backfilled and reconciled before the encrypted-only reader is deployed; otherwise existing history fails closed. Historical AI result migration/rotation remains unfinished.
