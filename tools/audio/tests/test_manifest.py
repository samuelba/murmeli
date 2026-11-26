from pathlib import Path

import yaml

from murmeli_audio.config import Paths
from murmeli_audio.jobs import Candidate, build_jobs, job_key
from murmeli_audio.manifest import build_manifest, post_tasks, write_manifest
from murmeli_audio.overrides import load_overrides
from murmeli_audio.state import StateStore

from .conftest import write_tone


def _setup(paths: Paths):
    cands = [
        Candidate("de-CH", "M wie Maus", "lexicon:carriers.M"),
        Candidate("de-CH", "Super gemacht!", "i18n:great"),
        Candidate("en-US", "Great job!", "i18n:great"),
        Candidate("en-US", "Try again.", "i18n:again"),
    ]
    jobs = build_jobs(cands, {"de-CH": "vd", "en-US": "ve"}, "qwen3", "q1")
    state = StateStore(paths.state_file)
    statuses = {"M wie Maus": "ok", "Super gemacht!": "flagged", "Great job!": "ok", "Try again.": "rendered"}
    for job in jobs:
        status = statuses[job.text]
        state.update(
            job.key,
            status=status,
            wav=f".cache/wav/{job.key}.wav",
            file=f"{job.locale}/{job.key}.opus",
            duration_ms=900,
            post_origin="tts",
        )
    return jobs, state


def _human(paths: Paths, mapping: dict, files: dict[str, str]) -> None:
    for rel in files:
        write_tone(paths.human / rel)
    (paths.human / "overrides.yaml").write_text(yaml.safe_dump(mapping, allow_unicode=True), encoding="utf-8")


def test_manifest_shape_and_statuses(paths: Paths) -> None:
    jobs, state = _setup(paths)
    manifest = build_manifest(jobs, state, [], generated_at="2026-01-01T00:00:00+00:00")
    assert set(manifest) == {"version", "generatedAt", "locales"}
    de, en = manifest["locales"]["de-CH"], manifest["locales"]["en-US"]
    assert len(de) == 2 and len(en) == 1
    entry = next(e for e in de.values() if e["text"] == "M wie Maus")
    assert entry == {
        "text": "M wie Maus",
        "file": entry["file"],
        "durationMs": 900,
        "engine": "qwen3",
        "voice": "vd",
        "status": "ok",
        "sources": ["lexicon:carriers.M"],
    }
    assert {e["status"] for e in de.values()} == {"ok", "flagged"}
    again = build_manifest(jobs, state, [], generated_at="later")
    assert again["version"] == manifest["version"] and len(manifest["version"]) == 12


def test_human_override_takes_precedence(paths: Paths) -> None:
    jobs, state = _setup(paths)
    _human(
        paths,
        {
            "de-CH": {"M wie Maus": "m.wav", "Sch": "sch.wav", "Fehlt": "missing.wav", "Böse": "../x.wav"},
            "fr-FR": {"x": "y.wav"},
        },
        {"de-CH/m.wav": "", "de-CH/sch.wav": "", "x.wav": ""},
    )
    humans = load_overrides(paths, jobs)
    assert [h.text for h in humans] == ["M wie Maus", "Sch"]
    maus_job = next(j for j in jobs if j.text == "M wie Maus")
    assert humans[0].key == maus_job.key
    assert humans[1].key == job_key("de-CH", "Sch", "human", "human", humans[1].sha256[:16])

    tasks = post_tasks(jobs, state, paths, humans)
    assert [t.origin for t in tasks if t.key == maus_job.key] == ["human"]

    for clip in humans:
        state.update(
            clip.key,
            post_origin="human",
            post_sha=clip.sha256,
            file=f"de-CH/{clip.key}.opus",
            duration_ms=500,
        )
    de = build_manifest(jobs, state, humans)["locales"]["de-CH"]
    assert de[maus_job.key]["status"] == "human" and de[maus_job.key]["engine"] == "human"
    assert de[humans[1].key]["text"] == "Sch"


def test_stale_human_encode_is_not_published_as_tts(paths: Paths) -> None:
    jobs, state = _setup(paths)
    maus = next(j for j in jobs if j.text == "M wie Maus")
    state.update(maus.key, post_origin="human")
    assert maus.key not in build_manifest(jobs, state, [])["locales"]["de-CH"]


def test_overrides_absent(paths: Paths) -> None:
    assert load_overrides(paths, []) == []


def test_write_manifest(paths: Paths) -> None:
    target = write_manifest(
        paths, {"version": "x", "generatedAt": "t", "locales": {"de-CH": {"k": {"text": "grösser"}}}}
    )
    assert target == paths.out / "manifest.json"
    assert "grösser" in Path(target).read_text(encoding="utf-8")


def test_post_tasks_skip_unrendered_and_missing(paths: Paths) -> None:
    jobs, state = _setup(paths)
    assert post_tasks(jobs, state, paths, []) == []
    ok_job = jobs[0]
    write_tone(paths.root / state.get(ok_job.key)["wav"])
    assert [t.key for t in post_tasks(jobs, state, paths, [])] == [ok_job.key]
