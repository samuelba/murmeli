import re
import shutil
import subprocess

import pytest

from murmeli_audio.config import Paths
from murmeli_audio.jobs import Candidate, build_jobs
from murmeli_audio.postprocess import PostTask, duration_ms, postprocess, second_pass_filter
from murmeli_audio.review import render_html, rows, write_review
from murmeli_audio.state import StateStore

from .conftest import write_tone

needs_ffmpeg = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")


def test_second_pass_applies_measured_gain() -> None:
    flt = second_pass_filter({"input_i": "-23.5", "input_tp": "-5.0"})
    assert "volume=7.50dB" in flt and "alimiter=limit=0.841" in flt and "level=false" in flt
    assert "volume" not in second_pass_filter({"input_i": "-inf"})


@needs_ffmpeg
def test_postprocess_trims_normalizes_and_caches(paths: Paths) -> None:
    source = paths.root / "in.wav"
    write_tone(source, seconds=0.6, lead=0.5)
    state = StateStore(paths.state_file)
    task = PostTask("abc", "de-CH", source)
    assert postprocess([task], paths, state) == 1
    target = paths.out / "de-CH" / "abc.opus"
    assert target.exists()
    entry = state.get("abc")
    assert entry["file"] == "de-CH/abc.opus" and entry["post_origin"] == "tts"
    assert 550 <= entry["duration_ms"] <= 850
    assert duration_ms(target) == entry["duration_ms"]
    assert -17.0 <= _loudness(target) <= -15.0
    assert postprocess([task], paths, state) == 0
    assert postprocess([task], paths, state, force=True) == 1


def _loudness(file) -> float:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(file),
            "-af",
            "apad=pad_dur=2,ebur128",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", result.stderr)[-1])


def test_review_lists_flagged_first_and_is_offline(paths: Paths) -> None:
    jobs = build_jobs(
        [
            Candidate("de-CH", "<b>Hallo</b>", "s1"),
            Candidate("en-US", "Hi", "s2"),
            Candidate("en-US", "New", "s3"),
            Candidate("en-US", "7", "s4", "seven"),
        ],
        {"de-CH": "v", "en-US": "w"},
        "fake",
        "1",
    )
    state = StateStore(paths.state_file)
    state.update(
        jobs[0].key, status="ok", file="de-CH/a.opus", wer=0.0, transcript="Hallo", attempt=0, seed=1
    )
    state.update(jobs[1].key, status="flagged", wav=".cache/wav/en-US/b.wav", wer=0.5, attempt=3, seed=9)
    state.update(jobs[3].key, status="ok", file="en-US/c.opus")
    table = rows(jobs, state, paths, [])
    assert [r["status"] for r in table] == ["flagged", "ok", "ok"]
    html = render_html(table, generated_at="now")
    assert html.index(jobs[1].key) < html.index(jobs[0].key)
    assert "&lt;b&gt;Hallo&lt;/b&gt;" in html and "<b>Hallo" not in html
    assert f"./run.sh reroll {jobs[1].key}" in html
    assert "../.cache/wav/en-US/b.wav" in html
    assert "speaks: seven" in html
    assert not re.search(r"(src|href)=\"https?:", html)
    assert write_review(paths, table).exists()
