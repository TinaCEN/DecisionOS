from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from threading import Lock

from fastapi import Request


@dataclass(frozen=True)
class RateLimitViolation:
    detail: dict[str, str]
    retry_after_seconds: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events_by_key: dict[str, deque[float]] = {}
        self._lock = Lock()

    def consume(
        self,
        *,
        key: str,
        max_requests: int,
        window_seconds: int,
        message: str,
    ) -> RateLimitViolation | None:
        now = time.monotonic()
        cutoff = now - float(window_seconds)

        with self._lock:
            events = self._events_by_key.get(key)
            if events is None:
                events = deque()
                self._events_by_key[key] = events

            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= max_requests:
                oldest = events[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                return RateLimitViolation(
                    detail={"code": "RATE_LIMITED", "message": message},
                    retry_after_seconds=retry_after,
                )

            events.append(now)
            return None


def resolve_client_identifier(request: Request) -> str:
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"
