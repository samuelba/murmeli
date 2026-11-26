from __future__ import annotations

import json
import logging
import shutil
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from ..config import LOCALES, Paths
from ..jobs import Candidate

log = logging.getLogger(__name__)
NPM_TIMEOUT_S = 300


def cache_file(paths: Paths, locale: str) -> Path:
    return paths.cache / f"speakables.{locale}.json"


def load_speakables(paths: Paths, locale: str) -> list[dict[str, Any]] | None:
    """`npm run speakables` output: a pre-generated file, a live run, or run.sh's host-side cache."""
    pregenerated = paths.content_dir / f"speakables.{locale}.json"
    if pregenerated.exists():
        return _parse(pregenerated.read_text(encoding="utf-8"), str(pregenerated))
    live = _run_npm(paths.content_dir, locale)
    if live is not None:
        return live
    cached = cache_file(paths, locale)
    if paths.content_override is None and cached.exists():
        log.info("speakables %s: using %s (written by run.sh on the host)", locale, cached)
        return _parse(cached.read_text(encoding="utf-8"), str(cached))
    return None


def extract_speakables(paths: Paths) -> Iterator[Candidate]:
    for locale in LOCALES:
        items = load_speakables(paths, locale)
        if items is None:
            log.info("speakables %s unavailable", locale)
            continue
        for item in items:
            yield from _candidates(item, locale)


def _candidates(item: Any, locale: str) -> Iterator[Candidate]:
    text = item.get("text") if isinstance(item, dict) else None
    if not isinstance(text, str) or not text.strip():
        log.warning("speakables %s: invalid entry %r, skipped", locale, item)
        return
    speak = item.get("speak")
    speak = speak.strip() if isinstance(speak, str) and speak.strip() else None
    sources = [s for s in item.get("sources", []) if isinstance(s, str)] or ["speakables"]
    for source in sources:
        yield Candidate(locale, text.strip(), source, speak)


def _run_npm(content_dir: Path, locale: str) -> list[dict[str, Any]] | None:
    npm = shutil.which("npm")
    if npm is None or not (content_dir / "package.json").exists():
        return None
    try:
        result = subprocess.run(
            [npm, "run", "-s", "speakables", "--", "--locale", locale, "--json"],
            cwd=content_dir,
            capture_output=True,
            text=True,
            timeout=NPM_TIMEOUT_S,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.warning("npm run speakables failed for %s: %s", locale, exc)
        return None
    if result.returncode != 0:
        log.warning("npm run speakables failed for %s: %s", locale, result.stderr.strip()[-500:])
        return None
    return _parse(result.stdout, f"npm run speakables --locale {locale}")


def _parse(raw: str, origin: str) -> list[dict[str, Any]] | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.warning("%s: invalid JSON (%s)", origin, exc)
        return None
    if not isinstance(data, list):
        log.warning("%s: expected a JSON list", origin)
        return None
    return data
