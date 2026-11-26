from __future__ import annotations

import math
import struct
import wave
from collections.abc import Sequence
from pathlib import Path

import pytest

from murmeli_audio import engines
from murmeli_audio.config import Paths
from murmeli_audio.engines import SynthItem, TtsEngine


def write_tone(path: Path, seconds: float = 0.6, lead: float = 0.3, rate: int = 24000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    total = int((seconds + 2 * lead) * rate)
    for i in range(total):
        t = i / rate
        audible = lead <= t < lead + seconds
        sample = int(8000 * math.sin(2 * math.pi * 440 * t)) if audible else 0
        frames += struct.pack("<h", sample)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(bytes(frames))


class FakeEngine(TtsEngine):
    name = "fake"
    max_batch = 4
    calls: list[tuple[list[str], str, int]] = []

    def __init__(self, **_: object) -> None:
        pass

    @property
    def version(self) -> str:
        return "fake-1"

    def synthesize(self, items: Sequence[SynthItem], voice_id: str, seed: int) -> None:
        FakeEngine.calls.append(([i.key for i in items], voice_id, seed))
        for item in items:
            write_tone(item.out_path, seconds=0.2)


class FakeTranscriber:
    def __init__(self, answers: dict[str, list[str]] | None = None, default: str | None = None) -> None:
        self.answers = answers or {}
        self.default = default
        self.calls: list[str] = []

    def transcribe(self, wav: Path, locale: str) -> str:
        key = wav.stem
        self.calls.append(key)
        queue = self.answers.get(key)
        if queue:
            return queue.pop(0) if len(queue) > 1 else queue[0]
        return self.default or ""


@pytest.fixture(autouse=True)
def fake_engine() -> type[FakeEngine]:
    engines.register("fake", FakeEngine)
    FakeEngine.calls = []
    return FakeEngine


@pytest.fixture
def paths(tmp_path: Path) -> Paths:
    root = tmp_path / "tool"
    repo = tmp_path / "repo"
    root.mkdir()
    repo.mkdir()
    return Paths(root=root, repo=repo)
