# Buddy priority during journal analysis

Buddy Chat and Talk have a separate bounded admission lane and precede queued journal work at each private-worker stage boundary. GPU execution remains serialized. An already-running GPU stage finishes before Buddy takes over; this is not instantaneous preemption or concurrent GPU generation.

With Buddy enabled, journal analysis releases admission between safety classification, E4 emotions, PHQ screening, and response assembly. Results remain in the same request memory and are not shared across users. Classification and screening checks remain required; a failed separate screening call prevents completion. There is no device/model substitution.

While Talk owns the runtime, journal stages report TALK_BUSY. Existing account-scoped local recovery leaves jobs waiting_for_provider and retries every five seconds after ownership is released. It rechecks ownership, consent, safety state and current journal contents; completed jobs are not repeated. When preempted by Talk, a restarted job can recompute stages rather than resume unvalidated intermediate output.

Journal model loading can evict Buddy weights under the existing memory policy. Buddy prepares/warm-loads again before use. The current 16 GiB GPU does not support a promise that all journal and Buddy model weights remain resident together.

Validation: priority ordering, timeout cleanup, independent interactive capacity, journal stage assembly, failed-screening rejection, journal recovery/deduplication and consent revocation are covered by focused tests. Real simultaneous-use browser/GPU acceptance remains unverified. No live user jobs were modified for testing.

Restart services with the existing start-local-core.ps1 -EnableBuddy -LocalJson command to activate the scheduler. Stop Talk to release its session ownership and allow waiting journal work to continue. Healthy model residency may be retained after Stop according to the existing runtime policy.
