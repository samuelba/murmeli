from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import yaml

from .config import LOCALES, Paths
from .jobs import Job, job_key
from .state import file_sha256

log = logging.getLogger(__name__)
HUMAN = "human"


@dataclass(frozen=True)
class HumanClip:
    key: str
    locale: str
    text: str
    source: Path
    sha256: str


def load_overrides(paths: Paths, jobs: Iterable[Job]) -> list[HumanClip]:
    """Human recordings from human/overrides.yaml. They reuse the key of a matching job."""
    file = paths.human / "overrides.yaml"
    if not file.exists():
        return []
    data = yaml.safe_load(file.read_text(encoding="utf-8")) or {}
    job_keys = {(job.locale, job.text): job.key for job in jobs}
    clips: list[HumanClip] = []
    for locale, mapping in data.items():
        if locale not in LOCALES:
            log.warning("overrides: unsupported locale %s, skipped", locale)
            continue
        for text, name in (mapping or {}).items():
            source = (paths.human / locale / str(name)).resolve()
            if not source.is_relative_to((paths.human / locale).resolve()) or not source.is_file():
                log.warning("overrides: %s/%s not found, skipped", locale, name)
                continue
            sha = file_sha256(source)
            key = job_keys.get((locale, str(text))) or job_key(locale, str(text), HUMAN, HUMAN, sha[:16])
            clips.append(HumanClip(key, locale, str(text), source, sha))
    return clips
