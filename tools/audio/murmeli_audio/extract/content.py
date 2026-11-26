from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import yaml

from ..config import LOCALES, Paths
from ..jobs import Candidate

log = logging.getLogger(__name__)


def extract_content(paths: Paths) -> Iterator[Candidate]:
    root = paths.content_dir
    if not root.is_dir():
        log.info("content dir %s missing, skipped", root)
        return
    for file in sorted([*root.rglob("*.yaml"), *root.rglob("*.yml")]):
        rel = file.relative_to(root).as_posix()
        try:
            docs = list(yaml.safe_load_all(file.read_text(encoding="utf-8")))
        except yaml.YAMLError as exc:
            log.warning("content:%s: invalid YAML, skipped (%s)", rel, exc)
            continue
        for doc in docs:
            yield from walk(doc, f"content:{rel}#", None)


def walk(node: Any, path: str, locale: str | None) -> Iterator[Candidate]:
    if isinstance(node, dict):
        yield from _walk_mapping(node, path, locale)
    elif isinstance(node, list):
        for i, item in enumerate(node):
            yield from walk(item, f"{path}[{i}]", locale)


def _walk_mapping(node: dict, path: str, locale: str | None) -> Iterator[Candidate]:
    if node.get("speak") is False:
        return
    locale = node.get("locale", locale) if isinstance(node.get("locale"), str) else locale
    if all(isinstance(node.get(loc), str) for loc in LOCALES):
        for loc in LOCALES:
            yield Candidate(loc, node[loc].strip(), _join(path, loc))
    if "speak" in node:
        yield from _speak_field(node["speak"], _join(path, "speak"), locale)
    for key, value in node.items():
        if key == "speak" or (key in LOCALES and isinstance(value, str)):
            continue
        yield from walk(value, _join(path, str(key)), locale)


def _speak_field(value: Any, path: str, locale: str | None) -> Iterator[Candidate]:
    if isinstance(value, dict):
        for loc, text in value.items():
            for i, item in enumerate(_strings(text)):
                yield Candidate(str(loc), item, f"{_join(path, str(loc))}[{i}]")
        return
    texts = _strings(value)
    if texts and locale is None:
        log.warning("%s: speak without locale, skipped", path)
        return
    for i, item in enumerate(texts):
        yield Candidate(str(locale), item, f"{path}[{i}]")


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        return [v.strip() for v in value if isinstance(v, str) and v.strip()]
    return []


def _join(path: str, key: str) -> str:
    return f"{path}{key}" if path.endswith("#") else f"{path}.{key}"
