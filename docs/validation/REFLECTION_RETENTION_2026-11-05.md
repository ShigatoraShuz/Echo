# Urgent reflection retention — 2026-11-05

Save success and queued analysis now preserve title, body, tags, emotions, counts and selected photo previews. Private saves stay in the editor with an Open saved reflection link rather than forcing navigation. Saved fields are read-only; duplicate Save calls remain fenced by existing submission/finalization identity. Model loading, analysis progress or failure does not reset writing.

Only explicit New / Write Another clears the editor, submission identity and previews. Existing unsaved navigation guards, explicit draft resume, account consent and generation fences remain. Photo reads are invalidated on a new editor generation; completed analysis does not revoke its current previews. Saved records and earlier drafts are not deleted by New.

Validation: 28 focused frontend tests passed across New/Resume, draft restoration and editor behavior, including delayed/failed saves, duplicate clicks, photo retention and stale callbacks. Frontend type check passed. The initial photo test fixture was moved into the existing browser-stub scope; no production behavior was relaxed for it. Authenticated browser visual acceptance remains unverified. No backend/database/model policy change or push.

Pre-change archive: sibling Echo-recovery/C2-20261105T120121Z. Shared SeaLLMs/PHQ migration follows this urgent substage and remains separately gated.
