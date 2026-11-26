import json
import string
from pathlib import Path

import pytest
import yaml

from murmeli_audio.config import TOOL_ROOT, Paths
from murmeli_audio.extract import EXTRACTORS, collect, register_extractor
from murmeli_audio.extract.i18n import flatten, is_allowed, load_allowlist
from murmeli_audio.jobs import Candidate

CONTENT = """
world:
  title: {de-CH: Zahlenwiese, en-US: Number Meadow}
  levels:
    - prompt: {de-CH: "Zähle die Blumen.", en-US: "Count the flowers."}
      hint:
        speak: {de-CH: "Zeige auf jede Blume.", en-US: ["Point at each flower.", "Go slowly."]}
    - locale: de-CH
      speak: "Hör gut zu."
    - speak: "No locale here"
    - notes: {speak: false, de-CH: Geheim, en-US: Secret}
    - only_de: {de-CH: "Nur Deutsch"}
"""


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _texts(cands: list[Candidate], locale: str) -> list[str]:
    return [c.text for c in cands if c.locale == locale]


def test_content_extraction_is_tolerant(paths: Paths) -> None:
    _write(paths.content_dir / "math" / "world.yaml", CONTENT)
    _write(paths.content_dir / "broken.yaml", "a: [unclosed")
    cands = collect(paths, ["content"])
    assert _texts(cands, "de-CH") == [
        "Zahlenwiese",
        "Zähle die Blumen.",
        "Zeige auf jede Blume.",
        "Hör gut zu.",
    ]
    assert _texts(cands, "en-US") == [
        "Number Meadow",
        "Count the flowers.",
        "Point at each flower.",
        "Go slowly.",
    ]
    sources = {c.source for c in cands}
    assert "content:math/world.yaml#world.title.de-CH" in sources
    assert "content:math/world.yaml#world.levels[0].hint.speak.en-US[1]" in sources


def test_content_missing_dir_yields_nothing(paths: Paths) -> None:
    assert collect(paths, ["content"]) == []


def test_i18n_allowlist_and_placeholders(paths: Paths) -> None:
    _write(paths.allowlist, "# comment\nkid.feedback.*\nkid.title  # trailing\n")
    data = {"kid": {"title": "Hallo", "feedback": {"great": "Super!", "hi": "Hallo {{ name }}!"}}, "x": "no"}
    _write(paths.i18n_dir / "de-CH.json", json.dumps(data))
    _write(paths.i18n_dir / "en-US.json", "{broken")
    cands = collect(paths, ["i18n"])
    assert [(c.text, c.source) for c in cands] == [
        ("Super!", "i18n:kid.feedback.great"),
        ("Hallo", "i18n:kid.title"),
    ]


def test_i18n_empty_allowlist_skips(paths: Paths) -> None:
    _write(paths.i18n_dir / "de-CH.json", json.dumps({"a": "b"}))
    assert collect(paths, ["i18n"]) == []


def test_i18n_helpers(tmp_path: Path) -> None:
    assert flatten({"a": {"b": "x", "c": {"d": 1}}}) == {"a.b": "x", "a.c.d": 1}
    assert is_allowed("kid.feedback.great", ["kid.*.great"])
    assert not is_allowed("parent.title", ["kid.*"])
    assert load_allowlist(tmp_path / "missing.txt") == []


def test_lexicon_text_speak_and_scalars(paths: Paths) -> None:
    lex = {"numbers": {7: {"text": "7", "speak": "sieben"}}, "ops": {"plus": "plus"}, "list": ["eins", 3]}
    _write(paths.lexicon / "de-CH.yaml", yaml.safe_dump(lex, allow_unicode=True))
    cands = collect(paths, ["lexicon"])
    assert Candidate("de-CH", "7", "lexicon:numbers.7", "sieben") in cands
    assert Candidate("de-CH", "plus", "lexicon:ops.plus") in cands
    assert Candidate("de-CH", "3", "lexicon:list[1]") in cands


def test_collect_rejects_unknown_extractor(paths: Paths) -> None:
    with pytest.raises(ValueError, match="unknown extractor"):
        collect(paths, ["nope"])


def test_collect_filters_invalid_locale_and_warns_on_eszett(paths: Paths, caplog) -> None:
    register_extractor(
        "custom",
        lambda _: [
            Candidate("fr-FR", "Bonjour", "x"),
            Candidate("de-CH", "grösser", "y"),
            Candidate("de-CH", "groß", "z"),
            Candidate("de-CH", "  ", "w"),
        ],
    )
    try:
        cands = collect(paths, ["custom"])
    finally:
        EXTRACTORS.pop("custom")
    assert [c.text for c in cands] == ["grösser", "groß"]
    assert "ß" in caplog.text


def test_shipped_lexicons() -> None:
    real = Paths(root=TOOL_ROOT, repo=TOOL_ROOT / "missing-repo")
    cands = collect(real, ["lexicon"])
    for locale in ("de-CH", "en-US"):
        numbers = [c for c in cands if c.locale == locale and c.source.startswith("lexicon:numbers.")]
        assert [c.text for c in numbers] == [str(n) for n in range(101)]
        letters = {c.text for c in cands if c.locale == locale and c.source.startswith("lexicon:letters.")}
        assert set(string.ascii_uppercase) <= letters
        carriers = {
            c.source.rsplit(".", 1)[1]
            for c in cands
            if c.locale == locale and c.source.startswith("lexicon:carriers.")
        }
        assert set(string.ascii_uppercase) <= carriers
    de = [c for c in cands if c.locale == "de-CH"]
    assert not any("ß" in c.text + c.spoken for c in de)
    assert {"Ä", "Ö", "Ü"} <= {c.text for c in de if c.source.startswith("lexicon:letters.")}
    de_texts = {c.text for c in de}
    assert {
        "M wie Maus",
        "Sch wie Schule",
        "Ch wie Buch",
        "Ei wie Eis",
        "Au wie Auto",
        "Eu wie Eule",
    } <= de_texts
    assert {
        "Wie viel ist",
        "Zähle die",
        "Welche Zahl ist grösser?",
        "geteilt durch",
        "gleich",
        "mal",
    } <= de_texts
    en_texts = {c.text for c in cands if c.locale == "en-US"}
    assert {"M as in moon", "What is", "divided by", "equals", "times"} <= en_texts
