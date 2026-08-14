import re

# Explicit phrases only. This layer is intentionally conservative and must be
# reviewed with domain experts before production deployment.
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
