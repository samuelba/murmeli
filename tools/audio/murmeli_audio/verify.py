from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .config import Paths
from .engines import TtsEngine
from .jobs import Job
from .render import rerender
from .state import StateStore
from .textnorm import passes

log = logging.getLogger(__name__)
VERIFIABLE = ("rendered",)
RECHECKABLE = ("rendered", "ok", "failed", "flagged")


class Transcriber(Protocol):
    def transcribe(self, wav: Path, locale: str) -> str: ...


@dataclass(frozen=True)
class VerifySummary:
    checked: int
    ok: int
    flagged: int
    rerendered: int


def check(job: Job, transcript: str, threshold: float) -> tuple[bool, float]:
    ok, score = passes(job.spoken, transcript, job.locale, threshold)
    if ok or job.speak is None:
        return ok, score
    alt_ok, alt_score = passes(job.text, transcript, job.locale, threshold)
    return (True, alt_score) if alt_ok else (False, min(score, alt_score))


def verify(
    jobs: Sequence[Job],
    state: StateStore,
    paths: Paths,
    transcriber: Transcriber,
    engine_factory: Callable[[], TtsEngine],
    *,
    threshold: float = 0.15,
    retries: int = 3,
    base_seed: int = 1234,
    force: bool = False,
) -> VerifySummary:
    by_key = {job.key: job for job in jobs}
    statuses = RECHECKABLE if force else VERIFIABLE
    todo = [k for k in state.with_status(*statuses) if k in by_key and not _approved(state, k)]
    checked, engine, rerendered = 0, None, 0
    try:
        while todo:
            failed = [
                job
                for job in (by_key[k] for k in todo)
                if not _check_one(job, state, paths, transcriber, threshold, retries)
            ]
            checked += len(todo)
            state.save()
            if not failed:
                break
            engine = engine or engine_factory()
            for job in failed:
                attempt = rerender(job, engine, paths, state, base_seed)
                log.info("re-rendered %s (attempt %d)", job.key, attempt)
                rerendered += 1
            todo = [job.key for job in failed]
    finally:
        if engine is not None:
            engine.close()
        state.save()
    statuses = [(state.get(k) or {}).get("status") for k in by_key]
    return VerifySummary(
        checked=checked,
        ok=statuses.count("ok"),
        flagged=statuses.count("flagged"),
        rerendered=rerendered,
    )


def rescore(jobs: Sequence[Job], state: StateStore, threshold: float = 0.15) -> int:
    """Re-check stored transcripts of failed clips (e.g. after a normalizer change), without ASR."""
    upgraded = 0
    for job in jobs:
        entry = state.get(job.key) or {}
        if entry.get("status") not in ("failed", "flagged") or entry.get("transcript") is None:
            continue
        ok, score = check(job, entry["transcript"], threshold)
        if ok:
            state.update(job.key, status="ok", wer=round(score, 4))
            upgraded += 1
    state.save()
    return upgraded


def _check_one(
    job: Job, state: StateStore, paths: Paths, transcriber: Transcriber, threshold: float, retries: int
) -> bool:
    entry = state.get(job.key) or {}
    transcript = transcriber.transcribe(paths.root / entry["wav"], job.locale)
    ok, score = check(job, transcript, threshold)
    attempt = int(entry.get("attempt", 0))
    status = "ok" if ok else ("failed" if attempt < retries else "flagged")
    history = [
        *entry.get("history", []),
        {"seed": entry.get("seed"), "wer": round(score, 4), "transcript": transcript},
    ]
    state.update(job.key, status=status, wer=round(score, 4), transcript=transcript, history=history)
    log.info("%s %s wer=%.2f %r -> %r", status, job.key, score, job.spoken, transcript)
    return status != "failed"


def _approved(state: StateStore, key: str) -> bool:
    return bool((state.get(key) or {}).get("approved"))
