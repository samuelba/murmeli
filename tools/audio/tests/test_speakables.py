import json
import subprocess
from pathlib import Path

import pytest
import yaml

from murmeli_audio.config import TOOL_ROOT, Paths
from murmeli_audio.extract import collect, speakables
from murmeli_audio.extract.lexicon import entries, lexicon_file
from murmeli_audio.jobs import Candidate

DE = [
    {"text": "Zahlenwiese", "sources": ["world:math-zahlenwiese.title"]},
    {"text": "7", "speak": "sieben", "sources": ["lexicon:numbers.7", "slot:number.7"]},
    {"text": " ", "sources": ["x"]},
    "garbage",
]
EN = [{"text": "Number Meadow", "sources": []}]


@pytest.fixture(autouse=True)
def no_npm(monkeypatch) -> None:
    monkeypatch.setattr(speakables.shutil, "which", lambda _: None)


def _pregenerate(paths: Paths, de=DE, en=EN) -> None:
    paths.content_dir.mkdir(parents=True, exist_ok=True)
    (paths.content_dir / "speakables.de-CH.json").write_text(json.dumps(de), encoding="utf-8")
    (paths.content_dir / "speakables.en-US.json").write_text(json.dumps(en), encoding="utf-8")


def test_pregenerated_file_is_primary(paths: Paths) -> None:
    _pregenerate(paths)
    (paths.content_dir / "x.yaml").write_text("t: {de-CH: Nur YAML, en-US: YAML only}")
    cands = collect(paths)
    assert Candidate("de-CH", "7", "lexicon:numbers.7", "sieben") in cands
    assert Candidate("de-CH", "7", "slot:number.7", "sieben") in cands
    assert Candidate("en-US", "Number Meadow", "speakables") in cands
    assert not any(c.text == "Nur YAML" for c in cands)
    assert len(cands) == 4


def test_falls_back_to_yaml_when_a_locale_is_missing(paths: Paths) -> None:
    paths.content_dir.mkdir(parents=True)
    (paths.content_dir / "speakables.de-CH.json").write_text(json.dumps(DE))
    (paths.content_dir / "x.yaml").write_text("t: {de-CH: Nur YAML, en-US: YAML only}")
    texts = {c.text for c in collect(paths)}
    assert "Nur YAML" in texts and "Zahlenwiese" not in texts


def test_invalid_json_is_unavailable(paths: Paths) -> None:
    paths.content_dir.mkdir(parents=True)
    (paths.content_dir / "speakables.de-CH.json").write_text("{nope")
    (paths.content_dir / "speakables.en-US.json").write_text('{"not": "a list"}')
    assert collect(paths, ["speakables"]) == []


def test_host_cache_only_for_default_content_dir(paths: Paths, tmp_path: Path) -> None:
    paths.cache.mkdir(parents=True)
    for locale, data in (("de-CH", DE), ("en-US", EN)):
        speakables.cache_file(paths, locale).write_text(json.dumps(data))
    assert len(collect(paths, ["speakables"])) == 4
    override = Paths(root=paths.root, repo=paths.repo, content_override=tmp_path / "other")
    assert collect(override, ["speakables"]) == []


def test_runs_npm_in_content_dir(paths: Paths, monkeypatch) -> None:
    paths.content_dir.mkdir(parents=True)
    (paths.content_dir / "package.json").write_text("{}")
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs["cwd"]))
        locale = cmd[cmd.index("--locale") + 1]
        if locale == "en-US":
            return subprocess.CompletedProcess(cmd, 1, "", "boom")
        return subprocess.CompletedProcess(cmd, 0, json.dumps(DE), "")

    monkeypatch.setattr(speakables.shutil, "which", lambda _: "/usr/bin/npm")
    monkeypatch.setattr(speakables.subprocess, "run", fake_run)
    assert speakables.load_speakables(paths, "de-CH") == DE
    assert speakables.load_speakables(paths, "en-US") is None
    assert calls[0] == (
        ["/usr/bin/npm", "run", "-s", "speakables", "--", "--locale", "de-CH", "--json"],
        paths.content_dir,
    )


def test_npm_timeout_is_unavailable(paths: Paths, monkeypatch) -> None:
    paths.content_dir.mkdir(parents=True)
    (paths.content_dir / "package.json").write_text("{}")

    def timeout(cmd, **_):
        raise subprocess.TimeoutExpired(cmd, 1)

    monkeypatch.setattr(speakables.shutil, "which", lambda _: "/usr/bin/npm")
    monkeypatch.setattr(speakables.subprocess, "run", timeout)
    assert speakables.load_speakables(paths, "de-CH") is None


def test_lexicon_prefers_content_and_ignores_top_level_flag(paths: Paths) -> None:
    (paths.root / "lexicon").mkdir()
    (paths.root / "lexicon" / "de-CH.yaml").write_text("ops: {plus: plus}")
    assert lexicon_file(paths, "de-CH") == paths.lexicon / "de-CH.yaml"
    (paths.content_dir / "lexicon").mkdir(parents=True)
    (paths.content_dir / "lexicon" / "de-CH.yaml").write_text("speak: false\nops: {plus: plus, mal: mal}")
    assert lexicon_file(paths, "de-CH") == paths.content_dir / "lexicon" / "de-CH.yaml"
    assert sorted(c.text for c in collect(paths, ["lexicon"])) == ["mal", "plus"]


CONTENT_LEXICON = TOOL_ROOT.parent.parent / "content" / "lexicon"


@pytest.mark.skipif(not CONTENT_LEXICON.is_dir(), reason="content package not present")
@pytest.mark.parametrize("locale", ["de-CH", "en-US"])
def test_tool_lexicon_is_a_subset_of_content_lexicon(locale: str) -> None:
    def load(file: Path) -> set[Candidate]:
        data = yaml.safe_load(file.read_text(encoding="utf-8"))
        data.pop("speak", None)
        return set(entries(data, locale, "lexicon:"))

    missing = load(TOOL_ROOT / "lexicon" / f"{locale}.yaml") - load(CONTENT_LEXICON / f"{locale}.yaml")
    assert not missing, f"tools/audio/lexicon drifted from content/lexicon: {sorted(missing)[:5]}"
