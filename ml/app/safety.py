import re

# Explicit phrases only. This conservative safety signal is independent from
# probabilistic model output and must be reviewed with domain experts before
# production use.
URGENT_PATTERNS = (
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bsuicide plan\b",
    r"\bwant to die\b",
    r"\bhurt myself\b",
)


def has_urgent_language(text: str) -> bool:
    normalized = text.casefold()
    return any(re.search(pattern, normalized) is not None for pattern in URGENT_PATTERNS)
