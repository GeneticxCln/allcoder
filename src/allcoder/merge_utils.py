from __future__ import annotations

from typing import Any


def deep_merge(a: Any, b: Any) -> Any:
    """Recursively merge b into a.

    - dict + dict: deep key-wise merge (b overrides a)
    - list + list: concatenate
    - otherwise: return b
    """
    if isinstance(a, dict) and isinstance(b, dict):
        out: dict = dict(a)
        for k, v in b.items():
            if k in out:
                out[k] = deep_merge(out[k], v)
            else:
                out[k] = v
        return out
    if isinstance(a, list) and isinstance(b, list):
        return a + b
    return b
