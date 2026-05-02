from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
import time
from typing import Any


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


_CACHE: dict[str, _CacheEntry] = {}
_LOCK = Lock()
_MAX_CACHE_ENTRIES = 10_000


def _cleanup_expired(now: float) -> None:
    expired_keys = [key for key, entry in _CACHE.items() if entry.expires_at <= now]
    for key in expired_keys:
        _CACHE.pop(key, None)


def get_or_set_cache(key: str, ttl_seconds: int, compute_fn):
    now = time.time()
    with _LOCK:
        cached = _CACHE.get(key)
        if cached and cached.expires_at > now:
            return cached.value
        if len(_CACHE) >= _MAX_CACHE_ENTRIES:
            _cleanup_expired(now)
            if len(_CACHE) >= _MAX_CACHE_ENTRIES:
                # Evict the oldest expiring key to keep memory bounded.
                oldest_key = min(_CACHE, key=lambda cache_key: _CACHE[cache_key].expires_at)
                _CACHE.pop(oldest_key, None)

    value = compute_fn()
    with _LOCK:
        _CACHE[key] = _CacheEntry(value=value, expires_at=now + ttl_seconds)
    return value


def clear_cache(prefix: str | None = None) -> int:
    with _LOCK:
        if prefix is None:
            count = len(_CACHE)
            _CACHE.clear()
            return count

        keys = [k for k in _CACHE if k.startswith(prefix)]
        for key in keys:
            _CACHE.pop(key, None)
        return len(keys)
