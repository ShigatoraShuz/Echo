# Buddy Chat and Talk counselor policy, 2026-11-18

The supplied production logs identify repeated `BUDDY_RESPONSE_WITHHELD` responses after 16–17 seconds. They do not preserve the rejected issue codes, so the precise historical trigger cannot be recovered. The previous JSON response normalization did not change Python quality gating. Repeating the same conversation and system prompt also repeated the sampling seed.

Live Talk uses `echo_cbt_spoken_counselor_20261118` and typed Chat now uses `echo_cbt_chat_counselor_20261118`. Both share relaxed style approval and 1,536-token initial/rewrite budgets. The shared SEA-LION base, adapters, screening, and clinical boundaries are unchanged. Journal recommendations explicitly select the earlier strict review, prompts, stopping preferences, and 900/650 budgets.

| Review evidence | Retained implementation | Evaluation |
| --- | --- | --- |
| Reviewer 1, M03, page 8: emotional validation, specific strategies, reflection, complete endings | Prompt asks for specific acknowledgement and one explained starting action; practical-help and completeness checks still block delivery. Reflection is optional and relevant. | P1/P2/P3 and paraphrases, plus incomplete-action regressions. |
| Reviewer 2, M03, page 8: preserve validation for low motivation | Concern-specific prompts acknowledge the person's difficulty without minimizing it or diagnosing. | Persistent symptoms versus ordinary stress examples. |
| Reviewer 2, page 13 synthesis across models: depth for emptiness, reduced enjoyment, and self-worth | Keep persistent-concern support and concrete-start checks; recommend professional support where warranted without a fixed sentence position. | Persistent support omissions remain blocking. |
| Product decision rather than a counselor requirement | Exactly requested list counts capped at ten; 1,536 tokens for initial/rewrite Chat and Talk, roughly 60-word soft stopping target for ordinary replies. | Counts 1/3/7/10/above ten, context and stopping checks. |

M03 maps to `mixed_epochs_2` by the user's mapping; blinded forms alone do not establish that identity. Original review forms, reviewed answers, and scores are preserved. Reviewer credentials are not runtime prompts or fixtures.

Length, incidental headings/bullets, stock phrases, question count, stacked-advice wording, and phrase-based discourse warnings are advisory for Chat and Talk. One improvement rewrite is attempted. Among candidates without blocking issues, select the candidate with fewer advisory findings, preferring the initial candidate on ties. A complete reply at the token ceiling can be accepted; an unfinished one cannot. Formatting preserves all non-whitespace content.

Blocking checks retain empty/unfinished replies, incomplete or duplicated list items, wrong requested counts, verbatim user copying, required practical action, and concern-specific professional support. Safety routing precedes generation and remains blocking.

Withholding diagnostics contain only allowlisted issue codes, initial/rewrite attempt counts, and attempt findings. The backend pairs these with its transport correlation ID and generation attempt number. Drafts, prompts, paths, and user text are excluded. Safety withholding and authorization/cancellation failures stop retries. Each generation retry keeps the accepted transcript and turn identity while varying its seed.

Typed Chat's `/v2/chat` internal request accepts an optional bounded `generationAttempt` (0–5). The backend attempts generation up to five times, retaining the same conversation and persisting only after success. It logs sanitized withholding reasons under `operation: chat` and `deliveryMode: chat`. The public `/buddy/messages` request and response schemas are unchanged.

Automated checks do not establish clinical effectiveness or renewed reviewer approval. Human review of naturalness and listening quality remains necessary. GPU and automated validation outcomes are reported separately; the policy itself does not imply a completed real-audio test.

## Validation evidence

- Python policy, runtime, integration, lifecycle, journal recommendation isolation, and private IPC transport suites: 155 passed.
- Backend Chat/Talk client, realtime Talk, and experience-service suites: 76 passed, including five-attempt exhaustion, fresh retry IDs, and no retry for safety withholding/authentication failures.
- Backend type checking and policy integrity verification passed.
- Regressions cover initial/rewrite acceptance, retained advisory findings, complete token-capped outputs, context reduction without latest-message truncation, matching Chat/Talk budgets, retained strict journal review, and list counts capped at ten.

The retained approved outputs for P1, P2, P3, P2-paraphrase, and P3-paraphrase were rechecked with the revised Talk rules. All five have no blocking findings; P1 has an advisory length finding. The historical P1-paraphrase output was withheld, so it provides no approved reply to rescore. These are existing generated outputs, not a fresh model comparison or renewed reviewer approval.

Fresh GPU generation and microphone/audio playback were not run: the active installation was using about 7.7 GiB of the 16 GiB GPU, leaving about 8.1 GiB free. Starting an independent HF test worker requires 7 GiB plus the existing 2 GiB headroom reserve. The active user runtime was not evicted. Restart the coordinated Buddy launcher to load this Python policy into the existing resident worker before a live multi-turn listening check.

Subsequent speech preparation work started the coordinated launcher after its ports became free and completed real synthetic Nano/Whisper checks. See `SPEECH_PREPARATION_2026-11-18.md` for the results. This does not replace the outstanding fresh CBT generation comparison or human microphone/listening review.
