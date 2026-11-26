from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from .config import WHISPER_LANGUAGES, Paths
from .models import WHISPER, fetch

log = logging.getLogger(__name__)


class WhisperTranscriber:
    def __init__(self, paths: Paths, model: str = "large-v3", device: str = "auto") -> None:
        from faster_whisper import WhisperModel

        spec = WHISPER.get(model)
        source = str(fetch(spec, paths.models)) if spec else model
        resolved = _device(device)
        compute = "float16" if resolved == "cuda" else "int8"
        log.info("loading whisper %s on %s (%s)", model, resolved, compute)
        self._model: Any = WhisperModel(source, device=resolved, compute_type=compute)

    def transcribe(self, wav: Path, locale: str) -> str:
        segments, _ = self._model.transcribe(
            str(wav),
            language=WHISPER_LANGUAGES[locale],
            beam_size=5,
            condition_on_previous_text=False,
            vad_filter=False,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()


def _device(device: str) -> str:
    if device != "auto":
        return device
    try:
        import ctranslate2

        return "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    except ImportError:
        return "cpu"
