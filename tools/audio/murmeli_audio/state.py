from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

Entry = Mapping[str, Any]


class StateStore:
    """Per-clip pipeline state, persisted as one JSON file in the cache dir."""

    def __init__(self, path: Path, entries: dict[str, dict[str, Any]] | None = None) -> None:
        self.path = path
        self._entries: dict[str, dict[str, Any]] = entries or {}

    @classmethod
    def load(cls, path: Path) -> StateStore:
        if not path.exists():
            return cls(path)
        return cls(path, json.loads(path.read_text(encoding="utf-8")))

    def get(self, key: str) -> Entry | None:
        entry = self._entries.get(key)
        return dict(entry) if entry is not None else None

    def update(self, key: str, **fields: Any) -> Entry:
        merged = {**self._entries.get(key, {}), **fields}
        self._entries = {**self._entries, key: merged}
        return dict(merged)

    def keys(self) -> list[str]:
        return list(self._entries)

    def with_status(self, *statuses: str) -> list[str]:
        return [k for k, v in self._entries.items() if v.get("status") in statuses]

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".state-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(self._entries, handle, ensure_ascii=False, indent=1, sort_keys=True)
        os.replace(tmp, self.path)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()
