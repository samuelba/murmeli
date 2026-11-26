import json

import pytest

from murmeli_audio.config import Paths
from murmeli_audio.voices import list_candidates, load_selected, load_voice, save_selected, voice_dir


def test_selected_roundtrip(paths: Paths) -> None:
    assert load_selected(paths) == {}
    save_selected(paths, {"de-CH": "de-CH-c1-abc"})
    assert load_selected(paths) == {"de-CH": "de-CH-c1-abc"}


def test_load_voice_and_candidates(paths: Paths) -> None:
    assert list_candidates(paths, "de-CH") == []
    folder = voice_dir(paths, "de-CH", "de-CH-c1-abc")
    folder.mkdir(parents=True)
    (folder / "meta.json").write_text(json.dumps({"ref_text": "Hallo", "seed": 1}))
    (voice_dir(paths, "de-CH", "junk")).mkdir()
    voice = load_voice(paths, "de-CH", "de-CH-c1-abc")
    assert voice.ref_text == "Hallo" and voice.ref_wav == folder / "ref.wav"
    assert list_candidates(paths, "de-CH") == ["de-CH-c1-abc"]
    with pytest.raises(FileNotFoundError, match="design-voice"):
        load_voice(paths, "de-CH", "missing")
