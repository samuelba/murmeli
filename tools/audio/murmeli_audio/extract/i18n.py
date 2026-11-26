from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterator
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any

from ..config import LOCALES, Paths
from ..jobs import Candidate

log = logging.getLogger(__name__)
PLACEHOLDER = re.compile(r"\{\{.*?\}\}|\{[a-zA-Z_][\w.]*\}")


def load_allowlist(file: Path) -> list[str]:
    if not file.exists():
        return []
    lines = (line.split("#", 1)[0].strip() for line in file.read_text(encoding="utf-8").splitlines())
    return [line for line in lines if line]


def flatten(data: Any, prefix: str = "") -> dict[str, Any]:
    if not isinstance(data, dict):
        return {prefix: data} if prefix else {}
    flat: dict[str, Any] = {}
    for key, value in data.items():
        flat.update(flatten(value, f"{prefix}.{key}" if prefix else str(key)))
    return flat


def is_allowed(key: str, patterns: list[str]) -> bool:
    return any(fnmatchcase(key, pattern) for pattern in patterns)


def extract_i18n(paths: Paths) -> Iterator[Candidate]:
    patterns = load_allowlist(paths.allowlist)
    if not patterns:
        log.info("i18n allowlist %s is empty, skipped", paths.allowlist)
        return
    for locale in LOCALES:
        file = paths.i18n_dir / f"{locale}.json"
        if not file.exists():
            log.info("i18n file %s missing, skipped", file)
            continue
        try:
            flat = flatten(json.loads(file.read_text(encoding="utf-8")))
        except json.JSONDecodeError as exc:
            log.warning("i18n:%s: invalid JSON, skipped (%s)", file.name, exc)
            continue
        for key, value in sorted(flat.items()):
            if not isinstance(value, str) or not is_allowed(key, patterns):
                continue
            if PLACEHOLDER.search(value):
                log.warning("i18n:%s:%s has a placeholder, cannot pre-render", locale, key)
                continue
            yield Candidate(locale, value.strip(), f"i18n:{key}")
