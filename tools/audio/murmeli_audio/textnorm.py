from __future__ import annotations

import re
import unicodedata

from .numwords import to_words

LETTER_ALIASES = {
    "de": {
        "be": "b",
        "ce": "c",
        "de": "d",
        "ef": "f",
        "ge": "g",
        "ha": "h",
        "jot": "j",
        "jott": "j",
        "ka": "k",
        "el": "l",
        "em": "m",
        "en": "n",
        "pe": "p",
        "ku": "q",
        "er": "r",
        "es": "s",
        "te": "t",
        "vau": "v",
        "fau": "v",
        "we": "w",
        "ix": "x",
        "ypsilon": "y",
        "zet": "z",
        "zett": "z",
        "beh": "b",
        "zeh": "c",
        "tseh": "c",
        "deh": "d",
        "eh": "e",
        "geh": "g",
        "hah": "h",
        "kah": "k",
        "peh": "p",
        "kuh": "q",
        "teh": "t",
        "uh": "u",
        "weh": "w",
        "einhundert": "hundert",
        "eintausend": "tausend",
    },
    "en": {
        "ay": "a",
        "bee": "b",
        "cee": "c",
        "see": "c",
        "sea": "c",
        "dee": "d",
        "ee": "e",
        "ef": "f",
        "eff": "f",
        "gee": "g",
        "aitch": "h",
        "eye": "i",
        "jay": "j",
        "kay": "k",
        "el": "l",
        "ell": "l",
        "em": "m",
        "en": "n",
        "oh": "o",
        "pee": "p",
        "cue": "q",
        "queue": "q",
        "ar": "r",
        "are": "r",
        "es": "s",
        "ess": "s",
        "tee": "t",
        "tea": "t",
        "you": "u",
        "vee": "v",
        "ex": "x",
        "why": "y",
        "zee": "z",
        "zed": "z",
        "doubleu": "w",
    },
}
SYMBOLS = {
    "de": {"+": " plus ", "×": " mal ", "*": " mal ", "÷": " geteilt durch ", "=": " gleich "},
    "en": {"+": " plus ", "×": " times ", "*": " times ", "÷": " divided by ", "=": " equals "},
}
THOUSANDS_SEP = re.compile(r"(?<=\d)['’.,](?=\d{3}\b)")
MINUS = re.compile(r"(?<=\d)\s*[-−]\s*(?=\d)")
NUMBER = re.compile(r"\d+")
DOUBLE_U = re.compile(r"\bdouble[\s-]+(?:u|you)\b")


def _lang(locale: str) -> str:
    return "de" if locale.startswith("de") else "en"


def normalize(text: str, locale: str) -> list[str]:
    aliases = LETTER_ALIASES[_lang(locale)]
    return [aliases.get(token, token) for token in tokens(text, locale)]


def tokens(text: str, locale: str) -> list[str]:
    lang = _lang(locale)
    value = unicodedata.normalize("NFC", text).lower().replace("ß", "ss")
    value = THOUSANDS_SEP.sub("", value)
    value = MINUS.sub(" minus ", value)
    if lang == "de":
        value = value.replace("ph", "f")
    for symbol, word in SYMBOLS[lang].items():
        value = value.replace(symbol, word)
    value = NUMBER.sub(lambda m: f" {_number(m.group(), locale)} ", value)
    value = DOUBLE_U.sub("doubleu", value)
    value = "".join(" " if unicodedata.category(ch)[0] in "PSZ" else ch for ch in value)
    return value.split()


def _number(digits: str, locale: str) -> str:
    try:
        return to_words(int(digits), locale)
    except ValueError:
        return digits


def edit_distance(ref: list[str], hyp: list[str]) -> int:
    previous = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        current = [i]
        for j, h in enumerate(hyp, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (r != h)))
        previous = current
    return previous[-1]


def wer(reference: str, hypothesis: str, locale: str) -> float:
    ref = normalize(reference, locale)
    hyp = normalize(hypothesis, locale)
    if not ref:
        return 0.0 if not hyp else 1.0
    if "".join(tokens(reference, locale)) == "".join(tokens(hypothesis, locale)):
        return 0.0
    return edit_distance(ref, hyp) / len(ref)


def passes(reference: str, hypothesis: str, locale: str, threshold: float) -> tuple[bool, float]:
    score = wer(reference, hypothesis, locale)
    if len(normalize(reference, locale)) <= 1:
        return score == 0.0, score
    return score <= threshold, score
