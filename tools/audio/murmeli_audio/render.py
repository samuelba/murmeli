from __future__ import annotations

import logging
import time
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from fnmatch import fnmatchcase
from itertools import groupby
from pathlib import Path

from .config import Paths
from .engines import SynthItem, TtsEngine
from .jobs import Job
from .state import StateStore

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class RenderStats:
    clips: int
    seconds: float

    @property
    def per_minute(self) -> float:
        return self.clips / self.seconds * 60 if self.seconds > 0 else 0.0


def seed_for(key: str, attempt: int, base_seed: int) -> int:
    return (int(key[:8], 16) + base_seed + attempt * 7919) % 2**31


def wav_path(paths: Paths, job: Job) -> Path:
    return paths.wav_dir / job.locale / f"{job.key}.wav"


def matches(job: Job, patterns: Sequence[str]) -> bool:
    if not patterns:
        return True
    fields = [job.key, job.text, *job.sources]
    return any(fnmatchcase(value, pattern) for pattern in patterns for value in fields)


def select(jobs: Iterable[Job], patterns: Sequence[str] = (), limit: int | None = None) -> list[Job]:
    chosen = [job for job in jobs if matches(job, patterns)]
    return chosen[:limit] if limit else chosen


def pending(jobs: Iterable[Job], state: StateStore, paths: Paths, skip: set[str]) -> list[Job]:
    def done(job: Job) -> bool:
        entry = state.get(job.key)
        return bool(entry and entry.get("status")) and wav_path(paths, job).exists()

    return [job for job in jobs if job.key not in skip and not done(job)]


def render_jobs(
    jobs: Sequence[Job],
    engine: TtsEngine,
    paths: Paths,
    state: StateStore,
    *,
    seed: int,
    batch_size: int | None = None,
    attempt: int = 0,
) -> RenderStats:
    size = max(1, min(batch_size or engine.max_batch, engine.max_batch))
    started = time.monotonic()
    done = 0
    ordered = sorted(jobs, key=lambda j: (j.locale, j.voice, len(j.spoken)))
    for (locale, voice), group in groupby(ordered, key=lambda j: (j.locale, j.voice)):
        batch_jobs = list(group)
        for start in range(0, len(batch_jobs), size):
            chunk = batch_jobs[start : start + size]
            batch_seed = seed if attempt == 0 else seed_for(chunk[0].key, attempt, seed)
            items = [SynthItem(j.key, j.spoken, locale, wav_path(paths, j)) for j in chunk]
            engine.synthesize(items, voice, batch_seed)
            for job in chunk:
                _record(state, paths, job, batch_seed, attempt)
            state.save()
            done += len(chunk)
            log.info("rendered %d/%d (%s)", done, len(jobs), locale)
    return RenderStats(done, time.monotonic() - started)


def rerender(job: Job, engine: TtsEngine, paths: Paths, state: StateStore, base_seed: int) -> int:
    entry = state.get(job.key) or {}
    attempt = int(entry.get("attempt", 0)) + 1
    render_jobs([job], engine, paths, state, seed=base_seed, batch_size=1, attempt=attempt)
    return attempt


def _record(state: StateStore, paths: Paths, job: Job, seed: int, attempt: int) -> None:
    state.update(
        job.key,
        locale=job.locale,
        text=job.text,
        speak=job.spoken,
        engine=job.engine,
        voice=job.voice,
        wav=wav_path(paths, job).relative_to(paths.root).as_posix(),
        seed=seed,
        attempt=attempt,
        status="rendered",
        wer=None,
        transcript=None,
        approved=False,
        rendered_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
