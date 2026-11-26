import hashlib
import json

import pytest

from murmeli_audio.jobs import Candidate, Job, build_jobs, job_key, read_jobs, write_jobs


def test_key_is_truncated_sha256_of_canonical_payload() -> None:
    payload = {"engine": "qwen3", "engine_version": "v1", "locale": "de-CH", "text": "Hallo", "voice_id": "v"}
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    expected = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    assert job_key("de-CH", "Hallo", "v", "qwen3", "v1") == expected


@pytest.mark.parametrize(
    "changed",
    [
        ("en-US", "Hallo", "v", "qwen3", "v1"),
        ("de-CH", "Hallo!", "v", "qwen3", "v1"),
        ("de-CH", "Hallo", "w", "qwen3", "v1"),
        ("de-CH", "Hallo", "v", "piper", "v1"),
        ("de-CH", "Hallo", "v", "qwen3", "v2"),
    ],
)
def test_every_field_changes_the_key(changed: tuple[str, ...]) -> None:
    assert job_key(*changed) != job_key("de-CH", "Hallo", "v", "qwen3", "v1")


def test_speak_only_affects_key_when_different() -> None:
    base = job_key("de-CH", "7", "v", "e", "1")
    assert job_key("de-CH", "7", "v", "e", "1", speak="7") == base
    assert job_key("de-CH", "7", "v", "e", "1", speak="sieben") != base


def test_key_shape() -> None:
    key = job_key("en-US", "Great job!", "v", "e", "1")
    assert len(key) == 16 and all(c in "0123456789abcdef" for c in key)


def test_build_jobs_dedups_and_merges_sources() -> None:
    cands = [
        Candidate("de-CH", "Super gemacht!", "i18n:a"),
        Candidate("de-CH", "Super gemacht!", "content:x#y"),
        Candidate("en-US", "Great job!", "i18n:a"),
        Candidate("de-CH", "7", "lexicon:numbers.7", speak="sieben"),
    ]
    jobs = build_jobs(cands, {"de-CH": "vd", "en-US": "ve"}, "fake", "fake-1")
    assert len(jobs) == 3
    super_job = next(j for j in jobs if j.text == "Super gemacht!")
    assert super_job.sources == ("content:x#y", "i18n:a")
    assert super_job.voice == "vd"
    seven = next(j for j in jobs if j.text == "7")
    assert seven.spoken == "sieben" and seven.speak == "sieben"
    assert seven.key == job_key("de-CH", "7", "vd", "fake", "fake-1", speak="sieben")


def test_jobs_roundtrip(tmp_path) -> None:
    jobs = build_jobs([Candidate("en-US", "Hi", "s", None)], {"en-US": "v", "de-CH": "w"}, "e", "1")
    path = tmp_path / "jobs.jsonl"
    assert write_jobs(path, jobs) == 1
    assert read_jobs(path) == jobs
    assert "speak" not in path.read_text()


def test_read_jobs_missing_file(tmp_path) -> None:
    with pytest.raises(FileNotFoundError, match="extract"):
        read_jobs(tmp_path / "nope.jsonl")


def test_job_from_dict_defaults() -> None:
    job = Job.from_dict(
        {"key": "k", "locale": "de-CH", "text": "t", "voice": "v", "engine": "e", "engine_version": "1"}
    )
    assert job.sources == () and job.spoken == "t"
