from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .base import SynthItem, TtsEngine

EngineFactory = Callable[..., TtsEngine]
_REGISTRY: dict[str, EngineFactory] = {}


def register(name: str, factory: EngineFactory) -> None:
    _REGISTRY[name] = factory


def available() -> list[str]:
    return sorted(_REGISTRY)


def create(name: str, **kwargs: Any) -> TtsEngine:
    if name not in _REGISTRY:
        raise ValueError(f"unknown engine {name!r}; available: {', '.join(available())}")
    return _REGISTRY[name](**kwargs)


def _qwen3(**kwargs: Any) -> TtsEngine:
    from .qwen3 import Qwen3Engine

    return Qwen3Engine(**kwargs)


def _piper(**kwargs: Any) -> TtsEngine:
    from .piper import PiperEngine

    return PiperEngine(**kwargs)


def _orpheus(**kwargs: Any) -> TtsEngine:
    from .orpheus import OrpheusEngine

    return OrpheusEngine(**kwargs)


register("qwen3", _qwen3)
register("piper", _piper)
register("orpheus", _orpheus)

__all__ = ["SynthItem", "TtsEngine", "available", "create", "register"]
