from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import Paths


@dataclass(frozen=True)
class VoiceRef:
    voice_id: str
    locale: str
    ref_wav: Path
    ref_text: str
    meta: dict[str, Any]


def voice_dir(paths: Paths, locale: str, voice_id: str) -> Path:
    return paths.voices / locale / voice_id


def load_voice(paths: Paths, locale: str, voice_id: str) -> VoiceRef:
    folder = voice_dir(paths, locale, voice_id)
    meta_file = folder / "meta.json"
    if not meta_file.exists():
        raise FileNotFoundError(f"voice {voice_id} not found in {folder}; run `design-voice`")
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    return VoiceRef(voice_id, locale, folder / "ref.wav", meta["ref_text"], meta)


def load_selected(paths: Paths) -> dict[str, str]:
    if not paths.selected_voices.exists():
        return {}
    return json.loads(paths.selected_voices.read_text(encoding="utf-8"))


def save_selected(paths: Paths, selected: dict[str, str]) -> None:
    paths.selected_voices.parent.mkdir(parents=True, exist_ok=True)
    paths.selected_voices.write_text(json.dumps(selected, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def list_candidates(paths: Paths, locale: str) -> list[str]:
    folder = paths.voices / locale
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.iterdir() if (p / "meta.json").exists())
