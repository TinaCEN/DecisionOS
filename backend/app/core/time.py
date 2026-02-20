from __future__ import annotations

from datetime import UTC, datetime


def utc_now_iso() -> str:
    """Return a lexicographically sortable UTC timestamp."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
