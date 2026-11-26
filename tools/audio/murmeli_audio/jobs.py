from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from pathlib import Path

KEY_LENGTH = 16


def job_key(
    locale: str,
    text: str,
    voice_id: str,
    engine: str,
    engine_version: str,
    speak: str | None = None,
) -> str:
    payload: dict[str, str] = {
        "locale": locale,
        "text": text,
        "voice_id": voice_id,
        "engine": engine,
        "engine_version": engine_version,
    }
    if speak is not None and speak != text:
        payload["speak"] = speak
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:KEY_LENGTH]


@dataclass(frozen=True)
class Candidate:
    locale: str
    text: str
    source: str
    speak: str | None = None

    @property
    def spoken(self) -> str:
        return self.speak or self.text


@dataclass(frozen=True)
class Job:
    key: str
    locale: str
    text: str
    voice: str
    engine: str
    engine_version: str
    sources: tuple[str, ...] = field(default_factory=tuple)
    speak: str | None = None

    @property
    def spoken(self) -> str:
        return self.speak or self.text

    def to_json(self) -> str:
        data = asdict(self)
        data["sources"] = list(self.sources)
        if data["speak"] is None:
            del data["speak"]
        return json.dumps(data, ensure_ascii=False, sort_keys=True)

    @classmethod
    def from_dict(cls, data: dict) -> Job:
        return cls(
            key=data["key"],
            locale=data["locale"],
            text=data["text"],
            voice=data["voice"],
            engine=data["engine"],
            engine_version=data["engine_version"],
            sources=tuple(data.get("sources", ())),
            speak=data.get("speak"),
        )


def build_jobs(
    candidates: Iterable[Candidate],
    voices: dict[str, str],
    engine: str,
    engine_version: str,
) -> list[Job]:
    merged: dict[tuple[str, str, str], list[Candidate]] = {}
    for cand in candidates:
        merged.setdefault((cand.locale, cand.text, cand.spoken), []).append(cand)
    jobs = []
    for (locale, text, spoken), group in merged.items():
        speak = spoken if spoken != text else None
        voice = voices[locale]
        jobs.append(
            Job(
                key=job_key(locale, text, voice, engine, engine_version, speak),
                locale=locale,
                text=text,
                voice=voice,
                engine=engine,
                engine_version=engine_version,
                sources=tuple(sorted({c.source for c in group})),
                speak=speak,
            )
        )
    return sorted(jobs, key=lambda j: (j.locale, j.sources[0] if j.sources else "", j.text))


def write_jobs(path: Path, jobs: Iterable[Job]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [job.to_json() for job in jobs]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    return len(lines)


def read_jobs(path: Path) -> list[Job]:
    if not path.exists():
        raise FileNotFoundError(f"{path} not found, run `extract` first")
    with path.open(encoding="utf-8") as handle:
        return [Job.from_dict(json.loads(line)) for line in handle if line.strip()]
