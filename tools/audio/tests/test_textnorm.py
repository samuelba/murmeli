import pytest

from murmeli_audio.numwords import english, german, to_words
from murmeli_audio.textnorm import edit_distance, normalize, passes, wer


@pytest.mark.parametrize(
    ("n", "de", "en"),
    [
        (0, "null", "zero"),
        (1, "eins", "one"),
        (16, "sechzehn", "sixteen"),
        (21, "einundzwanzig", "twenty-one"),
        (30, "dreissig", "thirty"),
        (77, "siebenundsiebzig", "seventy-seven"),
        (100, "hundert", "one hundred"),
        (101, "hunderteins", "one hundred one"),
        (1000, "tausend", "one thousand"),
        (2021, "zweitausendeinundzwanzig", "two thousand twenty-one"),
    ],
)
def test_number_words(n: int, de: str, en: str) -> None:
    assert german(n) == de
    assert english(n) == en
    assert to_words(n, "de-CH") == de


def test_number_words_range() -> None:
    with pytest.raises(ValueError):
        german(-1)
    with pytest.raises(ValueError):
        english(1_000_000)


def test_normalize_basics() -> None:
    assert normalize("Welche Zahl ist größer?", "de-CH") == ["welche", "zahl", "ist", "grösser"]
    assert normalize("  Super gemacht!!! ", "de-CH") == ["super", "gemacht"]
    assert normalize("Great job — really!", "en-US") == ["great", "job", "really"]


def test_normalize_numbers_both_ways() -> None:
    assert normalize("21", "de-CH") == normalize("einundzwanzig", "de-CH")
    assert normalize("21", "en-US") == normalize("Twenty-one.", "en-US")
    assert normalize("1'000", "de-CH") == ["tausend"]
    assert normalize("Einhundert", "de-CH") == normalize("100", "de-CH")


def test_normalize_math_symbols() -> None:
    assert normalize("7 + 5 = 12", "de-CH") == ["sieben", "plus", "fünf", "gleich", "zwölf"]
    assert normalize("9 - 3", "en-US") == ["nine", "minus", "three"]
    assert normalize("2 × 3", "en-US") == ["two", "times", "three"]


def test_letter_aliases() -> None:
    assert normalize("Em wie Maus", "de-CH") == normalize("M wie Maus.", "de-CH")
    assert normalize("Beh", "de-CH") == ["b"]
    assert normalize("double-u", "en-US") == ["w"]
    assert normalize("Em as in moon", "en-US") == normalize("M as in moon", "en-US")


def test_edit_distance_and_wer() -> None:
    assert edit_distance(["a", "b", "c"], ["a", "c"]) == 1
    assert edit_distance([], ["a"]) == 1
    assert wer("Tippe auf die richtige Zahl.", "Tippe auf die richtige Zahl", "de-CH") == 0.0
    assert wer("Tippe auf die richtige Zahl.", "Tippe auf richtige Zahl", "de-CH") == pytest.approx(0.2)
    assert wer("", "", "de-CH") == 0.0
    assert wer("", "noise", "de-CH") == 1.0


def test_passes_threshold_and_single_word_rule() -> None:
    ok, score = passes(
        "Ziehe die Äpfel in den Korb und dann weiter", "Ziehe die Äpfel in den Korb und dann", "de-CH", 0.15
    )
    assert ok and score == pytest.approx(1 / 9)
    assert not passes("Tap the correct number.", "Tap the number.", "en-US", 0.15)[0]
    assert passes("sieben", "7.", "de-CH", 0.15)[0]
    assert not passes("sieben", "sieben sieben", "de-CH", 0.9)[0]
    assert not passes("eins", "eins zwei", "de-CH", 1.0)[0]


def test_spacing_compounds_and_spelling_variants() -> None:
    assert wer("Das Zehnerfeld", "Das 10er-Feld", "de-CH") == 0.0
    assert wer("Wir machen Zehnerschritte.", "Wir machen 10er-Schritte.", "de-CH") == 0.0
    assert wer("Was kommt davor?", "Was kommt da vor?", "de-CH") == 0.0
    assert wer("Four tens and seven ones.", "Four 10s and seven 1s.", "en-US") == 0.0
    assert wer("X wie Xylofon", "X wie Xylophon", "de-CH") == 0.0
    assert wer("H, B und W", "B und W", "de-CH") > 0


def test_dash_is_minus_only_between_digits() -> None:
    assert normalize("To - ma - te", "de-CH") == normalize("To-Ma-Te", "de-CH")
    assert "minus" not in normalize("To - ma - te", "de-CH")
    assert normalize("12-4", "de-CH") == ["zwölf", "minus", "vier"]
