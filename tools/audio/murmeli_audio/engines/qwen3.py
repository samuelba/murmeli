from __future__ import annotations

import logging
import random
from collections.abc import Sequence
from typing import Any

from ..config import LANGUAGE_NAMES, Paths
from ..models import QWEN_BASE, QWEN_TTS_PACKAGE, fetch
from ..voices import load_voice
from .base import SynthItem, TtsEngine

log = logging.getLogger(__name__)

GENERATE_KWARGS: dict[str, Any] = {"max_new_tokens": 1024}


def seed_everything(seed: int) -> None:
    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed % 2**32)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_qwen(spec_path: str, device: str) -> Any:
    import torch
    from qwen_tts import Qwen3TTSModel

    return Qwen3TTSModel.from_pretrained(
        spec_path, device_map=device, dtype=torch.bfloat16, attn_implementation="sdpa"
    )


class Qwen3Engine(TtsEngine):
    name = "qwen3"
    max_batch = 8

    def __init__(self, paths: Paths | None = None, device: str = "cuda:0", **_: Any) -> None:
        self.paths = paths or Paths()
        self.device = device
        self._model: Any = None
        self._prompts: dict[str, Any] = {}

    @property
    def version(self) -> str:
        return f"{QWEN_TTS_PACKAGE}/{QWEN_BASE.short}"

    def _ensure_model(self) -> Any:
        if self._model is None:
            local = fetch(QWEN_BASE, self.paths.models)
            log.info("loading %s on %s", QWEN_BASE.short, self.device)
            self._model = load_qwen(str(local), self.device)
        return self._model

    def _prompt(self, locale: str, voice_id: str) -> Any:
        if voice_id not in self._prompts:
            voice = load_voice(self.paths, locale, voice_id)
            timbre_only = voice.clone_mode == "timbre"
            self._prompts[voice_id] = self._ensure_model().create_voice_clone_prompt(
                ref_audio=str(voice.ref_wav),
                ref_text=None if timbre_only else voice.ref_text,
                x_vector_only_mode=timbre_only,
            )
        return self._prompts[voice_id]

    def synthesize(self, items: Sequence[SynthItem], voice_id: str, seed: int) -> None:
        if not items:
            return
        import soundfile as sf

        locale = items[0].locale
        model = self._ensure_model()
        prompt = self._prompt(locale, voice_id)
        seed_everything(seed)
        wavs, sample_rate = model.generate_voice_clone(
            text=[item.text for item in items],
            language=[LANGUAGE_NAMES[item.locale] for item in items],
            voice_clone_prompt=prompt,
            **GENERATE_KWARGS,
        )
        for item, wav in zip(items, wavs, strict=True):
            item.out_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(item.out_path), wav, sample_rate)

    def close(self) -> None:
        self._model = None
        self._prompts = {}
        try:
            import torch

            torch.cuda.empty_cache()
        except ImportError:
            pass
