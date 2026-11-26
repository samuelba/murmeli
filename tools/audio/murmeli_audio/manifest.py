from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .config import LOCALES, Paths
from .jobs import Job
from .overrides import HUMAN, HumanClip
from .postprocess import PostTask
from .state import StateStore

PUBLISHED = ("ok", "flagged")


def post_tasks(
    jobs: Sequence[Job], state: StateStore, paths: Paths, humans: Sequence[HumanClip]
) -> list[PostTask]:
    human_keys = {h.key for h in humans}
    tasks = [PostTask(h.key, h.locale, h.source, HUMAN) for h in humans]
    for job in jobs:
        entry = state.get(job.key) or {}
        if job.key in human_keys or entry.get("status") not in PUBLISHED:
            continue
        source = paths.root / entry["wav"]
        if source.exists():
            tasks.append(PostTask(job.key, job.locale, source))
    return tasks


def build_manifest(
    jobs: Sequence[Job],
    state: StateStore,
    humans: Sequence[HumanClip],
    generated_at: str | None = None,
) -> dict[str, Any]:
    locales: dict[str, dict[str, dict[str, Any]]] = {locale: {} for locale in LOCALES}
    human_keys = {h.key for h in humans}
    for job in jobs:
        entry = state.get(job.key) or {}
        if job.key in human_keys or entry.get("status") not in PUBLISHED:
            continue
        if entry.get("post_origin", "tts") != "tts" or not entry.get("file"):
            continue
        locales[job.locale][job.key] = _entry(
            job.text, entry, job.engine, job.voice, entry["status"], job.sources
        )
    for clip in humans:
        entry = state.get(clip.key) or {}
        if entry.get("post_origin") == HUMAN and entry.get("post_sha") == clip.sha256 and entry.get("file"):
            locales[clip.locale][clip.key] = _entry(clip.text, entry, HUMAN, HUMAN, HUMAN, ())
    ordered = {loc: dict(sorted(clips.items())) for loc, clips in locales.items()}
    version = hashlib.sha256(json.dumps(ordered, sort_keys=True).encode()).hexdigest()[:12]
    return {
        "version": version,
        "generatedAt": generated_at or datetime.now(UTC).isoformat(timespec="seconds"),
        "locales": ordered,
    }


def _entry(
    text: str, entry: dict[str, Any], engine: str, voice: str, status: str, sources: Sequence[str]
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "text": text,
        "file": entry["file"],
        "durationMs": entry.get("duration_ms"),
        "engine": engine,
        "voice": voice,
        "status": status,
    }
    if sources:
        data["sources"] = list(sources)
    return data


def write_manifest(paths: Paths, manifest: dict[str, Any]) -> Path:
    target = paths.out / "manifest.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target
