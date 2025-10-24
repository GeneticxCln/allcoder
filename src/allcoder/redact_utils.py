from __future__ import annotations

from typing import Any


def redact_keys(obj: Any, keys: set[str], mask: str = "***REDACTED***") -> Any:
    """Return a copy of obj with matching keys redacted recursively."""
    if isinstance(obj, dict):
        out: dict = {}
        for k, v in obj.items():
            if isinstance(k, str) and k in keys:
                out[k] = mask
            else:
                out[k] = redact_keys(v, keys, mask)
        return out
    if isinstance(obj, list):
        return [redact_keys(x, keys, mask) for x in obj]
    return obj
