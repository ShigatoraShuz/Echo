# Worker startup integrity repair — 2026-11-04

The reported generic Text worker initialization failure was reproduced using an isolated worker with no user content. Its underlying exception was BUDDY_POLICY_INTEGRITY_FAILED.

Three pinned internal V3 files had CRLF bytes instead of their original LF bytes. Normalizing only those files reproduced their existing SHA-256 pins exactly; no prompts, policy, formatter behavior, or integrity pins were changed. Git attributes now preserve original bytes for internal V3 and Nano vendor files.

Restored 25 missing Nano model/codec companion assets, generated Buddy reference files, and local Whisper assets from original local sources. Nano assets were checked against assets.lock.json; voice identity passed the existing fixed reference hash. Updated models/manifest.json inventory to 84 files. Original sources and Python environments were not modified.

Validation:
- Real isolated text worker returned {"ready": true} after repairs, with no stderr startup error.
- Internal V3, exact adapter, Nano/codec/reference integrity checks passed.
- 42 transport/Buddy regression tests passed.
- CBT, Nano, and Whisper interpreter paths exist.
- Full authenticated browser conversation, simultaneous warm-up/headroom, microphone, and listening acceptance are not established by these checks.

Restart the existing launcher after stopping its old services:

```powershell
.\scripts\start-local-core.ps1 -EnableBuddy -LocalJson
```

Legacy vendor/cbt records retained in the manifest are historical. CoreRuntime explicitly skips them and verifies the separately pinned internal V3 policy. No obsolete code was copied back to satisfy unused records.
