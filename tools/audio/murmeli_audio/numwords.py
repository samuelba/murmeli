from __future__ import annotations

DE_ONES = (
    "null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf "
    "dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn"
).split()
DE_TENS = ["", "", "zwanzig", "dreissig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"]

EN_ONES = (
    "zero one two three four five six seven eight nine ten eleven twelve "
    "thirteen fourteen fifteen sixteen seventeen eighteen nineteen"
).split()
EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

MAX = 999_999


def german(n: int) -> str:
    _check(n)
    if n < 20:
        return DE_ONES[n]
    return _german(n, standalone=True)


def _german(n: int, standalone: bool) -> str:
    if n == 0:
        return ""
    if n == 1:
        return "eins" if standalone else "ein"
    if n < 20:
        return DE_ONES[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        return DE_TENS[tens] if ones == 0 else f"{_german(ones, False)}und{DE_TENS[tens]}"
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        head = "hundert" if hundreds == 1 else f"{_german(hundreds, False)}hundert"
        return head + _german(rest, standalone)
    thousands, rest = divmod(n, 1000)
    head = "tausend" if thousands == 1 else f"{_german(thousands, False)}tausend"
    return head + _german(rest, standalone)


def english(n: int) -> str:
    _check(n)
    if n < 20:
        return EN_ONES[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        return EN_TENS[tens] if ones == 0 else f"{EN_TENS[tens]}-{EN_ONES[ones]}"
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        head = f"{EN_ONES[hundreds]} hundred"
        return head if rest == 0 else f"{head} {english(rest)}"
    thousands, rest = divmod(n, 1000)
    head = f"{english(thousands)} thousand"
    return head if rest == 0 else f"{head} {english(rest)}"


def to_words(n: int, locale: str) -> str:
    return german(n) if locale.startswith("de") else english(n)


def _check(n: int) -> None:
    if not 0 <= n <= MAX:
        raise ValueError(f"number out of range 0..{MAX}: {n}")
