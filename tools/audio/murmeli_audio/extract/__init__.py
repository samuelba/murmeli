from __future__ import annotations

import logging
from collections.abc import Callable, Iterable

from ..config import LOCALES, Paths
from ..jobs import Candidate
from .content import extract_content
from .i18n import extract_i18n
from .lexicon import extract_lexicon
from .speakables import extract_speakables

log = logging.getLogger(__name__)

Extractor = Callable[[Paths], Iterable[Candidate]]

EXTRACTORS: dict[str, Extractor] = {
    "speakables": extract_speakables,
    "content": extract_content,
    "i18n": extract_i18n,
    "lexicon": extract_lexicon,
}


def register_extractor(name: str, extractor: Extractor) -> None:
    EXTRACTORS[name] = extractor


PRIMARY = "speakables"
WITH_PRIMARY = ("i18n",)
FALLBACK = ("content", "i18n", "lexicon")


def collect(paths: Paths, names: Iterable[str] | None = None) -> list[Candidate]:
    """Explicit `names`, or the default: content speakables + i18n, else the YAML fallback."""
    if names:
        return _run(paths, list(names))
    primary = _run(paths, [PRIMARY])
    if {c.locale for c in primary} >= set(LOCALES):
        return primary + _run(paths, list(WITH_PRIMARY))
    log.warning("content speakables unavailable for some locale, using the YAML and lexicon extractors")
    return _run(paths, list(FALLBACK))


def _run(paths: Paths, selected: list[str]) -> list[Candidate]:
    unknown = [n for n in selected if n not in EXTRACTORS]
    if unknown:
        raise ValueError(f"unknown extractor(s): {', '.join(unknown)}")
    candidates: list[Candidate] = []
    for name in selected:
        found = [c for c in EXTRACTORS[name](paths) if _valid(c)]
        log.info("extractor %s: %d strings", name, len(found))
        candidates.extend(found)
    return candidates


def _valid(cand: Candidate) -> bool:
    if cand.locale not in LOCALES:
        log.warning("%s: unsupported locale %s, skipped", cand.source, cand.locale)
        return False
    if not cand.text.strip():
        return False
    if cand.locale == "de-CH" and "ß" in cand.spoken + cand.text:
        log.warning("%s: de-CH text contains ß (use ss): %r", cand.source, cand.text)
    return True
