from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import yaml

from .config import LANGUAGE_NAMES, Paths
from .models import QWEN_DESIGN, QWEN_TTS_PACKAGE, fetch
from .voices import load_selected, save_selected, voice_dir

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DesignBrief:
    locale: str
    description: str
    ref_text: str


def load_briefs(paths: Paths) -> dict[str, DesignBrief]:
    data = yaml.safe_load((paths.voices / "design.yaml").read_text(encoding="utf-8")) or {}
    return {
        locale: DesignBrief(locale, " ".join(spec["description"].split()), " ".join(spec["ref_text"].split()))
        for locale, spec in data.items()
    }


def candidate_id(brief: DesignBrief, index: int, seed: int) -> str:
    payload = json.dumps([brief.description, brief.ref_text, seed, QWEN_DESIGN.revision])
    return f"{brief.locale}-c{index}-{hashlib.sha256(payload.encode()).hexdigest()[:6]}"


def design_voices(
    paths: Paths, locales: Sequence[str], count: int, base_seed: int, device: str = "cuda:0"
) -> dict[str, list[str]]:
    import soundfile as sf

    from .engines.qwen3 import load_qwen, seed_everything

    briefs = load_briefs(paths)
    model = load_qwen(str(fetch(QWEN_DESIGN, paths.models)), device)
    created: dict[str, list[str]] = {}
    for locale in locales:
        brief = briefs[locale]
        created[locale] = []
        for index in range(1, count + 1):
            seed = base_seed + index - 1
            voice_id = candidate_id(brief, index, seed)
            seed_everything(seed)
            wavs, sample_rate = model.generate_voice_design(
                text=brief.ref_text,
                language=LANGUAGE_NAMES[locale],
                instruct=brief.description,
                max_new_tokens=1024,
            )
            folder = voice_dir(paths, locale, voice_id)
            folder.mkdir(parents=True, exist_ok=True)
            sf.write(str(folder / "ref.wav"), wavs[0], sample_rate)
            meta = _meta(brief, voice_id, seed, sample_rate, len(wavs[0]) / sample_rate)
            (folder / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
            created[locale].append(voice_id)
            log.info("designed %s (%.1fs)", voice_id, meta["duration_s"])
    _default_selection(paths, created)
    return created


def _meta(brief: DesignBrief, voice_id: str, seed: int, sample_rate: int, duration: float) -> dict[str, Any]:
    return {
        "voice_id": voice_id,
        "locale": brief.locale,
        "description": brief.description,
        "ref_text": brief.ref_text,
        "seed": seed,
        "model": QWEN_DESIGN.repo,
        "model_revision": QWEN_DESIGN.revision,
        "package": QWEN_TTS_PACKAGE,
        "sample_rate": sample_rate,
        "duration_s": round(duration, 2),
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
    }


def _default_selection(paths: Paths, created: dict[str, list[str]]) -> None:
    selected = load_selected(paths)
    missing = {loc: ids[0] for loc, ids in created.items() if ids and loc not in selected}
    if missing:
        save_selected(paths, {**selected, **missing})
