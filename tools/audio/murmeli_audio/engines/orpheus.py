from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .base import SynthItem, TtsEngine

NOT_IMPLEMENTED = (
    "The Orpheus engine is a placeholder and is not implemented yet. It is the planned "
    "Apache-2.0 fallback (Orpheus TTS 3B, plus the German research finetune). Use "
    "`--engine qwen3` (GPU) or `--engine piper` (CPU placeholder) for now."
)


class OrpheusEngine(TtsEngine):
    name = "orpheus"

    def __init__(self, **_: Any) -> None:
        pass

    @property
    def version(self) -> str:
        return "orpheus-unimplemented"

    def synthesize(self, items: Sequence[SynthItem], voice_id: str, seed: int) -> None:
        raise NotImplementedError(NOT_IMPLEMENTED)
