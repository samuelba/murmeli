import json
from pathlib import Path

import pytest

from murmeli_audio import cli, pipeline
from murmeli_audio.config import Paths
from murmeli_audio.jobs import read_jobs
from murmeli_audio.pipeline import Context
from murmeli_audio.state import StateStore

from .conftest import FakeTranscriber, write_tone

SAMPLES = Path(__file__).resolve().parent.parent / "samples"


@pytest.fixture
def ctx(paths: Paths) -> Context:
    (paths.root / "speakable-i18n-keys.txt").write_text("kid.*\n")
    sample_paths = Paths(
        root=paths.root, repo=paths.repo, content_override=SAMPLES / "content", i18n_override=SAMPLES / "i18n"
    )
    return Context(paths=sample_paths, engine="fake", device="cpu", seed=5)


def _selected(paths: Paths) -> None:
    paths.voices.mkdir(parents=True, exist_ok=True)
    paths.selected_voices.write_text(json.dumps({"de-CH": "vd", "en-US": "ve"}))


def test_extract_requires_selected_voice(ctx: Context) -> None:
    with pytest.raises(KeyError, match="design-voice"):
        pipeline.run_extract(ctx)


def test_end_to_end_with_fake_engine(ctx: Context, monkeypatch) -> None:
    _selected(ctx.paths)
    jobs = pipeline.run_extract(ctx)
    texts = {j.text for j in jobs}
    assert {
        "Tippe auf die richtige Zahl.",
        "Tap the correct number.",
        "Zahlenwiese",
        "Point at each flower with your finger.",
    } <= texts
    assert not any("{{" in t for t in texts)

    stats = pipeline.run_render(ctx, only=["i18n:kid.feedback.*"])
    assert stats.clips == 6
    assert pipeline.run_render(ctx, only=["i18n:kid.feedback.*"]).clips == 0

    transcriber = FakeTranscriber({j.key: [j.spoken] for j in jobs})
    summary = pipeline.run_verify(ctx, transcriber)
    assert summary.ok == 6 and summary.flagged == 0

    monkeypatch.setattr(pipeline, "run_postprocess", lambda _ctx, force=False: 0)
    pipeline.finish(ctx)
    manifest = json.loads((ctx.paths.out / "manifest.json").read_text())
    assert manifest["locales"]["de-CH"] == {} and (ctx.paths.out / "review.html").exists()

    rendered = StateStore.load(ctx.paths.state_file).with_status("ok")
    pipeline.run_approve(ctx, rendered[:1])
    assert StateStore.load(ctx.paths.state_file).get(rendered[0])["approved"] is True
    with pytest.raises(KeyError):
        pipeline.run_approve(ctx, ["nope"])

    pipeline.run_reroll(ctx, rendered[:1], FakeTranscriber(default="wrong words entirely"), 0.15)
    assert StateStore.load(ctx.paths.state_file).get(rendered[0])["status"] == "flagged"
    with pytest.raises(KeyError):
        pipeline.run_reroll(ctx, ["nope"], transcriber, 0.15)


def test_cli_main_extract_manifest_review(paths: Paths, monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        cli,
        "_paths",
        lambda args: Paths(
            root=paths.root,
            repo=paths.repo,
            content_override=SAMPLES / "content",
            i18n_override=SAMPLES / "i18n",
        ),
    )
    _selected(paths)
    assert cli.main(["--engine", "fake", "extract", "--source", "content"]) == 0
    assert len(read_jobs(paths.jobs_file)) == 8
    only = tmp_path / "only.txt"
    only.write_text("# smoke\ncontent:*title*\n")
    assert cli.main(["--engine", "fake", "render", "--only-file", str(only)]) == 0
    assert len(StateStore.load(paths.state_file).keys()) == 2
    assert cli.main(["verify", "--rescore"]) == 0
    assert cli.main(["manifest"]) == 0
    assert cli.main(["review"]) == 0
    assert cli.main(["approve", "missing"]) == 1


def test_find_gaps_lists_every_clip_the_app_would_not_play(ctx: Context) -> None:
    _selected(ctx.paths)
    jobs = pipeline.run_extract(ctx)
    feedback = [j for j in jobs if any(s.startswith("i18n:kid.feedback.") for s in j.sources)]
    pipeline.run_render(ctx, only=["i18n:kid.feedback.*"])
    wrong = feedback[0]
    answers = {j.key: [j.spoken] for j in feedback}
    answers[wrong.key] = ["etwas anderes"]
    pipeline.run_verify(ctx, FakeTranscriber(answers), retries=0)

    gaps = {gap.job.key: gap.status for gap in pipeline.find_gaps(ctx)}
    assert gaps[wrong.key] == "flagged"
    assert all(gaps[j.key] == "missing" for j in jobs if j not in feedback)
    assert len(gaps) == len(jobs) - len(feedback) + 1

    pipeline.run_approve(ctx, [wrong.key])
    assert wrong.key not in {gap.job.key for gap in pipeline.find_gaps(ctx)}


def test_check_command_fails_while_gaps_remain(ctx: Context, monkeypatch, caplog) -> None:
    _selected(ctx.paths)
    pipeline.run_extract(ctx)
    monkeypatch.setattr(cli, "_paths", lambda args: ctx.paths)
    assert cli.main(["--engine", "fake", "check"]) == 2
    assert "not playable" in caplog.text and "approve" in caplog.text

    state = StateStore.load(ctx.paths.state_file)
    for job in read_jobs(ctx.paths.jobs_file):
        state.update(job.key, status="ok")
    state.save()
    assert cli.main(["--engine", "fake", "check"]) == 0


def test_gaps_name_each_status_and_skip_human_recordings(ctx: Context, monkeypatch) -> None:
    _selected(ctx.paths)
    jobs = pipeline.run_extract(ctx)
    unverified, failed, recorded = jobs[0], jobs[1], jobs[2]
    write_tone(ctx.paths.human / recorded.locale / "take.wav")
    (ctx.paths.human / "overrides.yaml").write_text(
        json.dumps({recorded.locale: {recorded.text: "take.wav"}}), encoding="utf-8"
    )
    state = StateStore.load(ctx.paths.state_file)
    for job in jobs:
        state.update(job.key, status="ok")
    state.update(unverified.key, status="rendered")
    state.update(failed.key, status="failed")
    state.update(recorded.key, status="flagged")
    state.save()

    gaps = {gap.job.key: gap.status for gap in pipeline.find_gaps(ctx)}
    assert gaps == {unverified.key: "unverified", failed.key: "failed"}

    monkeypatch.setattr(cli, "_paths", lambda args: ctx.paths)
    monkeypatch.setattr(pipeline, "finish", lambda _ctx: None)
    assert cli.main(["--engine", "fake", "approve", unverified.key]) == 2
    assert cli.main(["--engine", "fake", "approve", failed.key]) == 0


def test_cli_reports_missing_jobs(paths: Paths, monkeypatch) -> None:
    monkeypatch.setattr(cli, "_paths", lambda args: paths)
    assert cli.main(["manifest"]) == 1


def test_parser_has_all_commands() -> None:
    parser = cli.build_parser()
    for command in (
        "extract",
        "design-voice",
        "render",
        "verify",
        "postprocess",
        "manifest",
        "review",
        "all",
        "reroll",
        "approve",
        "check",
    ):
        assert (
            parser.parse_args([command, "k"] if command in ("reroll", "approve") else [command]).command
            == command
        )
