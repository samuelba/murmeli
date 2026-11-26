from pathlib import Path

import pytest

from murmeli_audio import engines
from murmeli_audio.config import Paths
from murmeli_audio.engines import SynthItem


def test_registry_lists_builtin_engines() -> None:
    assert {"qwen3", "piper", "orpheus", "fake"} <= set(engines.available())


def test_unknown_engine() -> None:
    with pytest.raises(ValueError, match="unknown engine"):
        engines.create("nope")


def test_orpheus_stub_raises(tmp_path: Path) -> None:
    engine = engines.create("orpheus")
    assert engine.name == "orpheus" and engine.version
    with pytest.raises(NotImplementedError, match="not implemented"):
        engine.synthesize([SynthItem("k", "Hi", "en-US", tmp_path / "x.wav")], "v", 1)


def test_qwen3_is_lazy(paths: Paths) -> None:
    engine = engines.create("qwen3", paths=paths, device="cpu")
    assert engine.name == "qwen3" and engine.max_batch > 1
    assert "Qwen3-TTS-12Hz-1.7B-Base@" in engine.version
    assert engine.voice_id("de-CH", {"de-CH": "de-CH-c1-abc"}) == "de-CH-c1-abc"
    with pytest.raises(KeyError, match="design-voice"):
        engine.voice_id("en-US", {})
    engine.synthesize([], "v", 1)


def test_piper_has_fixed_voices(paths: Paths) -> None:
    engine = engines.create("piper", paths=paths)
    assert engine.voice_id("de-CH", {}) == "de_DE-thorsten-medium"
    assert engine.version.startswith("piper-tts==")


def test_custom_engine_registration(fake_engine) -> None:
    engine = engines.create("fake")
    assert isinstance(engine, fake_engine)
    engine.close()
