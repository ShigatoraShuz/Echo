# Sentence batch option

Choose First 2 individually, then batches of 3 in Speech segments. Leave Wait for full response unchecked for early playback.

The first two sentences are generated and published individually. Remaining sentences are generated in groups of three; a final group may contain one or two sentences. Each sentence remains its own ordered audio segment. No character-count splitting or regrouping of the remainder into exactly three files occurs. A trailing fragment is preserved as its own final segment. Common abbreviations/initials do not end a sentence. Sentences over 512 text tokens are explicitly rejected rather than split or truncated.

The same saved voice, generation settings, CBT approval checks and buffered-player cancellation rules apply. Batching is a throughput option, not a promise of lower latency: each group is published when the full group is decoded. The first two are individually generated; playback can start with the first. Memory checks enforce 2 GiB headroom and actual batch sizes; unsupported requests are not silently downgraded. Current buffered mode remains the default.
