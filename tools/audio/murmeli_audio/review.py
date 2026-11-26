from __future__ import annotations

import os
from collections.abc import Sequence
from datetime import UTC, datetime
from html import escape
from pathlib import Path
from typing import Any

from .config import Paths
from .jobs import Job
from .overrides import HumanClip
from .state import StateStore

ORDER = {"flagged": 0, "failed": 1, "rendered": 2, "ok": 3, "human": 4}
WRAPPER = "./run.sh"

STYLE = """
:root{--bg:#fbfaf6;--fg:#1d2a22;--muted:#5d6b62;--card:#fff;--line:#dfe3dc;--bad:#b3261e;--ok:#2e7d32;--warn:#a35f00}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a24;--fg:#e8eef0;--muted:#9fb0b8;--card:#172532;--line:#2a3b49;--bad:#ff8a80;--ok:#81c784;--warn:#ffb74d}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
h1{font-size:1.4rem;margin:0 0 4px}.muted{color:var(--muted)}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;min-height:36px}
table{width:100%;border-collapse:collapse;background:var(--card)}
th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
td.text{font-size:1.05rem;font-weight:600}code{font-size:.8rem;word-break:break-all}
.s-flagged,.s-failed{color:var(--bad);font-weight:700}.s-ok,.s-human{color:var(--ok)}.s-rendered{color:var(--warn)}
audio{width:220px;max-width:100%}
@media (max-width:720px){thead{display:none}tr{display:block;border-bottom:2px solid var(--line)}td{display:block;border:0}}
"""

SCRIPT = """
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{
navigator.clipboard.writeText(b.dataset.copy).then(()=>{b.textContent='copied';setTimeout(()=>b.textContent=b.dataset.label,1200)})}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
const f=b.dataset.filter;document.querySelectorAll('tbody tr').forEach(r=>{
r.hidden=!(f==='all'||r.dataset.status===f||r.dataset.locale===f)})}));
"""


def rows(
    jobs: Sequence[Job], state: StateStore, paths: Paths, humans: Sequence[HumanClip]
) -> list[dict[str, Any]]:
    human_keys = {h.key: h for h in humans}
    result = []
    for job in jobs:
        entry = state.get(job.key) or {}
        status = "human" if job.key in human_keys else entry.get("status")
        if not status:
            continue
        result.append({"job": job, "entry": entry, "status": status, "audio": _audio(entry, paths)})
    return sorted(result, key=lambda r: (ORDER.get(r["status"], 9), r["job"].locale, r["job"].text))


def _audio(entry: dict[str, Any], paths: Paths) -> str | None:
    if entry.get("file"):
        return entry["file"]
    if entry.get("wav"):
        return os.path.relpath(paths.root / entry["wav"], paths.out)
    return None


def _row(row: dict[str, Any]) -> str:
    job: Job = row["job"]
    entry = row["entry"]
    wer = entry.get("wer")
    reroll = f"{WRAPPER} reroll {job.key}"
    approve = f"{WRAPPER} approve {job.key}"
    audio = (
        f'<audio controls preload="none" src="{escape(row["audio"])}"></audio>' if row["audio"] else "missing"
    )
    spoken = f'<div class="muted">speaks: {escape(job.spoken)}</div>' if job.speak else ""
    return (
        f'<tr data-status="{row["status"]}" data-locale="{job.locale}">'
        f'<td class="s-{row["status"]}">{row["status"]}</td><td>{job.locale}</td>'
        f'<td class="text">{escape(job.text)}{spoken}</td><td>{audio}</td>'
        f"<td>{escape(entry.get('transcript') or '')}</td>"
        f"<td>{'' if wer is None else f'{wer:.2f}'}</td>"
        f"<td>{entry.get('attempt', 0)} / seed {entry.get('seed', '')}</td>"
        f'<td><button data-copy="{escape(reroll)}" data-label="re-roll">re-roll</button> '
        f'<button data-copy="{escape(approve)}" data-label="approve">approve</button>'
        f"<div><code>{escape(job.key)}</code></div>"
        f'<div class="muted">{escape(", ".join(job.sources))}</div></td></tr>'
    )


def render_html(table_rows: list[dict[str, Any]], generated_at: str | None = None) -> str:
    counts: dict[str, int] = {}
    for row in table_rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    summary = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items(), key=lambda kv: ORDER.get(kv[0], 9)))
    filters = "".join(
        f'<button data-filter="{f}">{f}</button>' for f in ("all", "flagged", "ok", "human", "de-CH", "en-US")
    )
    stamp = generated_at or datetime.now(UTC).isoformat(timespec="seconds")
    body = "".join(_row(r) for r in table_rows)
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; '
        "style-src 'unsafe-inline'; script-src 'unsafe-inline'; media-src 'self'\">"
        f"<title>Audio review</title><style>{STYLE}</style></head><body>"
        f'<h1>Audio review</h1><div class="muted">{stamp} · {len(table_rows)} clips · {summary}</div>'
        f'<div class="bar">{filters}</div>'
        "<table><thead><tr><th>Status</th><th>Locale</th><th>Text</th><th>Audio</th>"
        "<th>ASR transcript</th><th>WER</th><th>Attempt</th><th>Actions</th></tr></thead>"
        f"<tbody>{body}</tbody></table><script>{SCRIPT}</script></body></html>\n"
    )


def write_review(paths: Paths, table_rows: list[dict[str, Any]]) -> Path:
    target = paths.out / "review.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_html(table_rows), encoding="utf-8")
    return target
