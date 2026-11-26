from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SynthItem:
    key: str
    text: str
    locale: str
    out_path: Path


class TtsEngine(ABC):
    """A text-to-speech backend. Implementations write one WAV file per item."""

    name: str = ""
    max_batch: int = 1

    @property
    @abstractmethod
    def version(self) -> str:
        """Pinned model/package identity; part of every job key."""

    def voice_id(self, locale: str, selected: Mapping[str, str]) -> str:
        if locale not in selected:
            raise KeyError(f"no voice selected for {locale}; run `design-voice` or edit voices/selected.json")
        return selected[locale]

    @abstractmethod
    def synthesize(self, items: Sequence[SynthItem], voice_id: str, seed: int) -> None:
        """Render all items (same locale and voice) and write them to item.out_path."""

    def close(self) -> None:
        return None
