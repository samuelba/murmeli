from murmeli_audio.config import Paths
from murmeli_audio.jobs import Candidate, build_jobs
from murmeli_audio.render import pending, render_jobs, seed_for, select, wav_path
from murmeli_audio.state import StateStore
from murmeli_audio.verify import check, rescore, verify

from .conftest import FakeEngine, FakeTranscriber

VOICES = {"de-CH": "vd", "en-US": "ve"}


def _jobs():
    cands = [
        Candidate("de-CH", "Super gemacht!", "i18n:kid.feedback.great"),
        Candidate("de-CH", "7", "lexicon:numbers.7", "sieben"),
        Candidate("en-US", "Great job!", "i18n:kid.feedback.great"),
        Candidate("en-US", "Tap the correct number.", "i18n:kid.instructions.tapNumber"),
        Candidate("en-US", "M", "lexicon:letters.M", "em"),
    ]
    return build_jobs(cands, VOICES, "fake", "fake-1")


def test_render_batches_by_locale_and_caches(paths: Paths) -> None:
    jobs = _jobs()
    state = StateStore.load(paths.state_file)
    stats = render_jobs(jobs, FakeEngine(), paths, state, seed=42, batch_size=2)
    assert stats.clips == 5 and stats.per_minute > 0
    assert [len(keys) for keys, _, _ in FakeEngine.calls] == [2, 2, 1]
    assert {voice for _, voice, _ in FakeEngine.calls} == {"vd", "ve"}
    assert all(seed == 42 for _, _, seed in FakeEngine.calls)
    assert all(wav_path(paths, j).exists() for j in jobs)
    reloaded = StateStore.load(paths.state_file)
    assert reloaded.with_status("rendered") and pending(jobs, reloaded, paths, set()) == []
    wav_path(paths, jobs[0]).unlink()
    assert pending(jobs, reloaded, paths, {jobs[1].key}) == [jobs[0]]


def test_select_by_source_glob_and_limit() -> None:
    jobs = _jobs()
    assert [j.text for j in select(jobs, ["i18n:kid.feedback.*"])] == ["Super gemacht!", "Great job!"]
    assert len(select(jobs, ["lexicon:*"], limit=1)) == 1
    assert select(jobs, [jobs[0].key]) == [jobs[0]]
    assert len(select(jobs)) == 5


def test_seed_for_differs_per_attempt() -> None:
    assert seed_for("abcdef0123456789", 1, 7) != seed_for("abcdef0123456789", 2, 7)


def test_check_accepts_speak_or_text() -> None:
    seven = next(j for j in _jobs() if j.text == "7")
    assert check(seven, "Sieben.", 0.15)[0]
    assert check(seven, "7", 0.15)[0]
    assert not check(seven, "acht", 0.15)[0]


def test_verify_passes_retries_and_flags(paths: Paths) -> None:
    jobs = _jobs()
    state = StateStore.load(paths.state_file)
    render_jobs(jobs, FakeEngine(), paths, state, seed=1)
    by_text = {j.text: j for j in jobs}
    good = {j.key: [j.spoken] for j in jobs}
    good[by_text["Great job!"].key] = ["Grape job", "Great job."]
    good[by_text["Tap the correct number."].key] = ["nonsense"]
    transcriber = FakeTranscriber(good)
    FakeEngine.calls = []

    summary = verify(jobs, state, paths, transcriber, FakeEngine, threshold=0.15, retries=2, base_seed=1)

    assert summary.flagged == 1 and summary.ok == 4 and summary.rerendered == 3
    flagged = state.get(by_text["Tap the correct number."].key)
    assert flagged["status"] == "flagged" and flagged["attempt"] == 2 and len(flagged["history"]) == 3
    great = state.get(by_text["Great job!"].key)
    assert great["status"] == "ok" and great["attempt"] == 1 and great["wer"] == 0.0
    assert len({seed for _, _, seed in FakeEngine.calls}) == 3


def test_verify_skips_approved_and_force_rechecks(paths: Paths) -> None:
    jobs = _jobs()[:2]
    state = StateStore.load(paths.state_file)
    render_jobs(jobs, FakeEngine(), paths, state, seed=1)
    state.update(jobs[0].key, approved=True)
    transcriber = FakeTranscriber(default="Super gemacht")
    verify(jobs, state, paths, transcriber, FakeEngine, retries=0)
    assert transcriber.calls == [jobs[1].key]
    assert verify(jobs, state, paths, transcriber, FakeEngine, retries=0).checked == 0
    assert verify(jobs, state, paths, transcriber, FakeEngine, retries=0, force=True).checked == 1


def test_rescore_upgrades_only_passing_transcripts(paths: Paths) -> None:
    jobs = _jobs()[:2]
    state = StateStore.load(paths.state_file)
    state.update(jobs[0].key, status="flagged", transcript="Super gemacht")
    state.update(jobs[1].key, status="flagged", transcript="acht")
    assert rescore(jobs, state) == 1
    assert state.get(jobs[0].key)["status"] == "ok"
    assert state.get(jobs[1].key)["status"] == "flagged"
