from __future__ import annotations

import logging
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import yaml

from ..config import LOCALES, Paths
from ..jobs import Candidate

log = logging.getLogger(__name__)


def lexicon_file(paths: Paths, locale: str) -> Path:
    """content/lexicon is canonical; tools/audio/lexicon is a subset kept for runs without content."""
    canonical = paths.content_dir / "lexicon" / f"{locale}.yaml"
    return canonical if canonical.exists() else paths.lexicon / f"{locale}.yaml"


def extract_lexicon(paths: Paths) -> Iterator[Candidate]:
    for locale in LOCALES:
        file = lexicon_file(paths, locale)
        if not file.exists():
            log.info("lexicon %s missing, skipped", file)
            continue
        data = yaml.safe_load(file.read_text(encoding="utf-8")) or {}
        yield from entries(_without_flags(data), locale, "lexicon:")


def _without_flags(data: Any) -> Any:
    return {k: v for k, v in data.items() if k != "speak"} if isinstance(data, dict) else data


def entries(node: Any, locale: str, path: str) -> Iterator[Candidate]:
    if isinstance(node, str):
        if node.strip():
            yield Candidate(locale, node.strip(), path)
    elif isinstance(node, (int, float)) and not isinstance(node, bool):
        yield Candidate(locale, str(node), path)
    elif isinstance(node, dict) and isinstance(node.get("text"), str):
        speak = node.get("speak")
        yield Candidate(locale, node["text"].strip(), path, speak.strip() if isinstance(speak, str) else None)
        for key, value in node.items():
            if key not in ("text", "speak"):
                yield from entries(value, locale, _child(path, key))
    elif isinstance(node, dict):
        for key, value in node.items():
            yield from entries(value, locale, _child(path, key))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            yield from entries(value, locale, f"{path}[{i}]")


def _child(path: str, key: Any) -> str:
    return f"{path}{key}" if path.endswith(":") else f"{path}.{key}"
