from __future__ import annotations

import logging
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from ..config import Paths
from .base import SynthItem, TtsEngine

log = logging.getLogger(__name__)

PIPER_PACKAGE = "piper-tts==1.8.0"
VOICES = {"de-CH": "de_DE-thorsten-medium", "en-US": "en_US-ljspeech-medium"}
LENGTH_SCALE = "1.15"


class PiperEngine(TtsEngine):
    """CPU placeholder for development and CI. Runs piper as a subprocess (GPL-3.0 package)."""

    name = "piper"

    def __init__(self, paths: Paths | None = None, **_: Any) -> None:
        self.paths = paths or Paths()
        self.data_dir = self.paths.models / "piper"

    @property
    def version(self) -> str:
        return PIPER_PACKAGE

    def voice_id(self, locale: str, selected: Mapping[str, str]) -> str:
        return VOICES[locale]

    def _model(self, voice_id: str) -> Path:
        model = self.data_dir / f"{voice_id}.onnx"
        if not model.exists():
            self.data_dir.mkdir(parents=True, exist_ok=True)
            log.info("downloading piper voice %s", voice_id)
            subprocess.run(
                [sys.executable, "-m", "piper.download_voices", voice_id, "--data-dir", str(self.data_dir)],
                check=True,
            )
        return model

    def synthesize(self, items: Sequence[SynthItem], voice_id: str, seed: int) -> None:
        model = self._model(voice_id)
        for item in items:
            item.out_path.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "piper",
                    "-m",
                    str(model),
                    "-f",
                    str(item.out_path),
                    "--length-scale",
                    LENGTH_SCALE,
                ],
                input=item.text,
                text=True,
                check=True,
                capture_output=True,
            )
