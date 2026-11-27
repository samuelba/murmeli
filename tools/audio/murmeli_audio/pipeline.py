from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from . import engines
from .config import LOCALES, Paths
from .extract import collect
from .jobs import Job, build_jobs, read_jobs, write_jobs
from .manifest import build_manifest, post_tasks, write_manifest
from .overrides import load_overrides
from .postprocess import postprocess
from .render import RenderStats, pending, render_jobs, rerender, select
from .review import rows, write_review
from .state import StateStore
from .verify import Transcriber, VerifySummary, rescore, verify
from .voices import load_selected

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Context:
    paths: Paths
    engine: str = "qwen3"
    device: str = "cuda:0"
    seed: int = 1234


def make_engine(ctx: Context, name: str | None = None) -> engines.TtsEngine:
    return engines.create(name or ctx.engine, paths=ctx.paths, device=ctx.device)


def run_extract(ctx: Context, extractors: Sequence[str] = ()) -> list[Job]:
    engine = make_engine(ctx)
    selected = load_selected(ctx.paths)
    voices = {locale: engine.voice_id(locale, selected) for locale in LOCALES}
    jobs = build_jobs(collect(ctx.paths, extractors), voices, engine.name, engine.version)
    write_jobs(ctx.paths.jobs_file, jobs)
    log.info("wrote %d jobs to %s", len(jobs), ctx.paths.jobs_file)
    return jobs


def _jobs_engine(jobs: Sequence[Job]) -> str:
    names = {job.engine for job in jobs}
    if len(names) > 1:
        raise ValueError(f"jobs.jsonl mixes engines {sorted(names)}; re-run extract")
    return names.pop() if names else "qwen3"


def run_render(
    ctx: Context, only: Sequence[str] = (), limit: int | None = None, batch_size: int | None = None
) -> RenderStats:
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    humans = {h.key for h in load_overrides(ctx.paths, jobs)}
    todo = select(pending(jobs, state, ctx.paths, humans), only, limit)
    if not todo:
        log.info("nothing to render, cache is up to date")
        return RenderStats(0, 0.0)
    engine = make_engine(ctx, _jobs_engine(jobs))
    try:
        stats = render_jobs(todo, engine, ctx.paths, state, seed=ctx.seed, batch_size=batch_size)
    finally:
        engine.close()
    log.info("rendered %d clips in %.1fs (%.1f clips/min)", stats.clips, stats.seconds, stats.per_minute)
    return stats


def run_verify(
    ctx: Context,
    transcriber: Transcriber,
    threshold: float = 0.15,
    retries: int = 3,
    force: bool = False,
) -> VerifySummary:
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    summary = verify(
        jobs,
        state,
        ctx.paths,
        transcriber,
        lambda: make_engine(ctx, _jobs_engine(jobs)),
        threshold=threshold,
        retries=retries,
        base_seed=ctx.seed,
        force=force,
    )
    log.info("verify: %s", summary)
    return summary


def run_rescore(ctx: Context, threshold: float = 0.15) -> int:
    jobs = read_jobs(ctx.paths.jobs_file)
    upgraded = rescore(jobs, StateStore.load(ctx.paths.state_file), threshold)
    log.info("rescore: %d flagged clips now pass", upgraded)
    return upgraded


def run_postprocess(ctx: Context, force: bool = False) -> int:
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    humans = load_overrides(ctx.paths, jobs)
    count = postprocess(post_tasks(jobs, state, ctx.paths, humans), ctx.paths, state, force)
    log.info("postprocessed %d clips", count)
    return count


def run_manifest(ctx: Context) -> Path:
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    manifest = build_manifest(jobs, state, load_overrides(ctx.paths, jobs))
    target = write_manifest(ctx.paths, manifest)
    counts = {loc: len(clips) for loc, clips in manifest["locales"].items()}
    log.info("manifest %s: %s", target, counts)
    return target


def run_review(ctx: Context) -> Path:
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    target = write_review(ctx.paths, rows(jobs, state, ctx.paths, load_overrides(ctx.paths, jobs)))
    log.info("review page: %s", target)
    return target


def run_reroll(ctx: Context, keys: Sequence[str], transcriber: Transcriber, threshold: float) -> None:
    jobs = {job.key: job for job in read_jobs(ctx.paths.jobs_file)}
    unknown = [k for k in keys if k not in jobs]
    if unknown:
        raise KeyError(f"unknown key(s): {', '.join(unknown)}")
    state = StateStore.load(ctx.paths.state_file)
    engine = make_engine(ctx, _jobs_engine(list(jobs.values())))
    try:
        for key in keys:
            rerender(jobs[key], engine, ctx.paths, state, ctx.seed)
    finally:
        engine.close()
    run_verify(ctx, transcriber, threshold=threshold, retries=0)
    finish(ctx)


def run_approve(ctx: Context, keys: Sequence[str]) -> None:
    state = StateStore.load(ctx.paths.state_file)
    for key in keys:
        if state.get(key) is None:
            raise KeyError(f"unknown key {key}")
        state.update(key, status="ok", approved=True)
    state.save()
    finish(ctx)


GAP_STATUS = {"rendered": "unverified", "failed": "failed", "flagged": "flagged"}


@dataclass(frozen=True)
class Gap:
    job: Job
    status: str


def find_gaps(ctx: Context) -> list[Gap]:
    """Jobs the app would not play: not rendered yet, failed, or flagged and not approved."""
    jobs = read_jobs(ctx.paths.jobs_file)
    state = StateStore.load(ctx.paths.state_file)
    human_keys = {h.key for h in load_overrides(ctx.paths, jobs)}
    gaps = []
    for job in jobs:
        status = (state.get(job.key) or {}).get("status", "missing")
        if job.key not in human_keys and status != "ok":
            gaps.append(Gap(job, GAP_STATUS.get(status, "missing")))
    return gaps


def finish(ctx: Context) -> None:
    run_postprocess(ctx)
    run_manifest(ctx)
    run_review(ctx)
