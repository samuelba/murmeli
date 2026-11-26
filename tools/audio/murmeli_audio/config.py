from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parent.parent
LOCALES: tuple[str, ...] = ("de-CH", "en-US")
LANGUAGE_NAMES = {"de-CH": "German", "en-US": "English"}
WHISPER_LANGUAGES = {"de-CH": "de", "en-US": "en"}


def _repo_root(tool_root: Path) -> Path:
    env = os.environ.get("MURMELI_REPO_ROOT")
    return Path(env) if env else tool_root.parent.parent


@dataclass(frozen=True)
class Paths:
    root: Path = TOOL_ROOT
    repo: Path = field(default_factory=lambda: _repo_root(TOOL_ROOT))
    content_override: Path | None = None
    i18n_override: Path | None = None

    @property
    def content_dir(self) -> Path:
        return self.content_override or self.repo / "content"

    @property
    def i18n_dir(self) -> Path:
        return self.i18n_override or self.repo / "frontend" / "public" / "i18n"

    @property
    def cache(self) -> Path:
        return self.root / ".cache"

    @property
    def jobs_file(self) -> Path:
        return self.cache / "jobs.jsonl"

    @property
    def state_file(self) -> Path:
        return self.cache / "state.json"

    @property
    def wav_dir(self) -> Path:
        return self.cache / "wav"

    @property
    def out(self) -> Path:
        return self.root / "out"

    @property
    def models(self) -> Path:
        env = os.environ.get("MURMELI_MODELS_DIR")
        return Path(env) if env else self.root / "models"

    @property
    def voices(self) -> Path:
        return self.root / "voices"

    @property
    def selected_voices(self) -> Path:
        return self.voices / "selected.json"

    @property
    def human(self) -> Path:
        return self.root / "human"

    @property
    def lexicon(self) -> Path:
        return self.root / "lexicon"

    @property
    def allowlist(self) -> Path:
        return self.root / "speakable-i18n-keys.txt"
