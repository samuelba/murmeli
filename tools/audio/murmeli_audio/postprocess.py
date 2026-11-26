from __future__ import annotations

import json
import logging
import re
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from .config import Paths
from .state import StateStore, file_sha256

log = logging.getLogger(__name__)

TARGET_LUFS = -16.0
TRUE_PEAK = -1.5
LRA = 11.0
SILENCE = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06"
TRIM = f"{SILENCE},areverse,{SILENCE},areverse"
LOUDNORM = f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA={LRA}"
MEASURE_PAD = "apad=pad_dur=1"
LIMITER = f"alimiter=limit={10 ** (TRUE_PEAK / 20):.3f}:attack=5:release=50:level=false:latency=true"
OPUS_ARGS = ["-ar", "48000", "-ac", "1", "-c:a", "libopus", "-b:a", "48k", "-vbr", "on"]
JSON_BLOCK = re.compile(r"\{[^{}]*\"input_i\"[^{}]*\}", re.S)


@dataclass(frozen=True)
class PostTask:
    key: str
    locale: str
    source: Path
    origin: str = "tts"


def out_file(paths: Paths, locale: str, key: str) -> Path:
    return paths.out / locale / f"{key}.opus"


def measure(source: Path) -> dict[str, str]:
    audio_filter = f"{TRIM},{MEASURE_PAD},{LOUDNORM}:print_format=json"
    result = _ffmpeg(["-i", str(source), "-af", audio_filter, "-f", "null", "-"])
    match = JSON_BLOCK.search(result.stderr)
    if not match:
        raise RuntimeError(f"loudnorm measurement failed for {source}")
    return json.loads(match.group())


def second_pass_filter(measured: dict[str, str]) -> str:
    """Linear gain to the target loudness; the limiter only engages above the true-peak ceiling.

    loudnorm's own second pass falls back to dynamic mode for clips shorter than its 3 s window
    or whenever the gain would exceed the ceiling, which misses the target on short clips.
    """
    if not _finite(measured.get("input_i")):
        return TRIM
    gain = TARGET_LUFS - float(measured["input_i"])
    return f"{TRIM},volume={gain:.2f}dB,{LIMITER}"


def encode(source: Path, target: Path) -> int:
    target.parent.mkdir(parents=True, exist_ok=True)
    audio_filter = second_pass_filter(measure(source))
    _ffmpeg(["-y", "-i", str(source), "-af", audio_filter, *OPUS_ARGS, str(target)])
    return duration_ms(target)


def duration_ms(file: Path) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(file)],
        capture_output=True,
        text=True,
        check=True,
    )
    return round(float(result.stdout.strip()) * 1000)


def postprocess(tasks: Iterable[PostTask], paths: Paths, state: StateStore, force: bool = False) -> int:
    count = 0
    for task in tasks:
        target = out_file(paths, task.locale, task.key)
        sha = file_sha256(task.source)
        entry = state.get(task.key) or {}
        if not force and entry.get("post_sha") == sha and target.exists():
            continue
        duration = encode(task.source, target)
        state.update(
            task.key,
            post_sha=sha,
            post_origin=task.origin,
            duration_ms=duration,
            file=target.relative_to(paths.out).as_posix(),
        )
        state.save()
        count += 1
        log.info("encoded %s (%d ms)", target.name, duration)
    return count


def _finite(value: str | None) -> bool:
    try:
        return value is not None and abs(float(value)) != float("inf")
    except ValueError:
        return False


def _ffmpeg(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True, check=True
    )
