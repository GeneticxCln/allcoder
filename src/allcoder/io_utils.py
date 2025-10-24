from __future__ import annotations

import json
from enum import Enum
from pathlib import Path
from typing import Any

import yaml
from tomlkit import dumps as toml_dumps
from tomlkit import parse as toml_parse


class Format(str, Enum):
    json = "json"
    yaml = "yaml"
    toml = "toml"


def detect_format(path: str | Path) -> Format:
    p = str(path).lower()
    if p.endswith(".json"):
        return Format.json
    if p.endswith(".yaml") or p.endswith(".yml"):
        return Format.yaml
    if p.endswith(".toml"):
        return Format.toml
    raise ValueError(f"Cannot detect format for {path}")


def read_data(path: Path) -> tuple[Any, Format]:
    fmt = detect_format(path)
    text = path.read_text(encoding="utf-8")
    if fmt is Format.json:
        return json.loads(text), fmt
    if fmt is Format.yaml:
        return yaml.safe_load(text), fmt
    if fmt is Format.toml:
        return toml_parse(text), fmt
    raise AssertionError("unreachable")


def dump_str(data: Any, fmt: Format) -> str:
    if fmt is Format.json:
        return json.dumps(data, indent=2, sort_keys=False, ensure_ascii=False) + "\n"
    if fmt is Format.yaml:
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    if fmt is Format.toml:
        return toml_dumps(data)
    raise AssertionError("unreachable")


def write_data(data: Any, path: Path, fmt: Format | None = None) -> None:
    if fmt is None:
        fmt = detect_format(path)
    path.write_text(dump_str(data, fmt), encoding="utf-8")
