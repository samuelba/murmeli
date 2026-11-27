# Offline TTS pipeline (`tools/audio`)

Renders every narrator clip for the app ahead of time: numbers, sentence frames, letter carriers,
instructions and feedback, in **de-CH** (Standard German pronunciation, Swiss spelling with "ss" and no sharp s) and
**en-US**. It runs on a developer machine with a GPU, not in CI and not as part of the app stack.
See section 5a of `docs/internal/plan.md` for the design.

```
extract → design-voice (once) → render → verify (ASR + re-roll) → postprocess → manifest → review
```

## Setup

### Docker with GPU (recommended)

You need Docker with the NVIDIA Container Toolkit. Check it with
`docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi`.
The image uses Python 3.12 and PyTorch 2.9.1 built for CUDA 12.8, which supports Blackwell GPUs (sm_120).

```bash
cd tools/audio
./run.sh build          # ~10 GB image: torch + CUDA libs, qwen-tts, faster-whisper, piper, ffmpeg
./run.sh test           # pytest inside the container
./run.sh all            # the whole pipeline
./run.sh shell          # debugging shell
```

`run.sh` mounts the repo read-only and `tools/audio` read-write, and runs as your user.
Model weights are downloaded on first use into `tools/audio/models/` (gitignored), pinned to exact
Hugging Face revisions (see `murmeli_audio/models.py`). Expect about 12 GB: 4.5 GB each for the
Qwen Base and VoiceDesign models and 3.1 GB for Whisper large-v3. Set `MURMELI_NO_GPU=1` to run the
container without a GPU, for example with `--engine piper` and `--model small`.

### Local venv (tests, CPU fallback)

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[dev]"            # tests only, no GPU deps
.venv/bin/python -m pytest
uv pip install --python .venv/bin/python -r requirements-gpu.lock --index-strategy unsafe-best-match
```

`requirements-gpu.lock` pins every dependency (generated with
`uv pip compile pyproject.toml --extra qwen --extra asr --extra piper --extra dev --python-version 3.12`).
You also need `ffmpeg` 6 or newer with libopus on the PATH. ffmpeg 5.1's loudnorm measures short clips wrong.

## Commands

All commands are `python -m murmeli_audio <command>` (or `./run.sh <command>`).
Global options: `--engine qwen3|piper|orpheus`, `--seed`, `--device`, `--content-dir`, `--i18n-dir`.

| Command | What it does |
|---|---|
| `extract` | Collects speakable strings into `.cache/jobs.jsonl`: the content speakables plus the allowed i18n keys, or the YAML fallback (see [Sources](#sources)). `--source speakables\|content\|i18n\|lexicon` picks extractors explicitly. |
| `design-voice` | Generates `--count` candidate narrators per locale with Qwen VoiceDesign from `voices/design.yaml` and writes `voices/<locale>/<voice_id>/{ref.wav,meta.json}`. |
| `render` | Renders all jobs that are not cached yet. `--only <glob>` (on source id, text or key), `--only-file`, `--limit`, `--batch-size`. |
| `verify` | Transcribes with faster-whisper (`--model large-v3` on GPU, `--model small` on CPU) and scores word error rate. Failures are re-rendered with a new seed up to `--retries` (3) times, then marked `flagged`. `--threshold` defaults to 0.15; single-word clips must match exactly. |
| `postprocess` | ffmpeg: trims leading and trailing silence, normalizes in two EBU R128 passes to -16 LUFS, and encodes 48 kHz mono Opus at 48 kbps to `out/<locale>/<key>.opus`. Pass 1 measures with `loudnorm`. Pass 2 applies that linear gain plus a -1.5 dB peak limiter, because `loudnorm`'s own second pass falls back to dynamic mode on clips shorter than 3 s. |
| `manifest` | Writes `out/manifest.json`. |
| `review` | Writes `out/review.html`, a static offline page with flagged clips first, players, ASR transcripts, WER and copyable commands. |
| `reroll KEY...` | Re-renders clips with a new seed, then verifies and rebuilds the outputs. |
| `approve KEY...` | Marks clips as `ok` after listening (for example a flagged clip that is fine). |
| `all` | extract → render → verify → postprocess → manifest → review. |

Everything is incremental. The job key is the first 16 hex characters of
`sha256({locale, text, voice_id, engine, engine_version})` (plus `speak` when the spoken form
differs from the label). Changing the model, the voice or the text gives a new key, and only
those clips are rendered again. Pipeline state lives in `.cache/state.json`, raw WAVs in `.cache/wav/`.

### Sources

By default `extract` uses the **content speakables** plus the **i18n** keys. When the speakables
can't be loaded for both locales, it falls back to the **content YAML**, **i18n** and **lexicon** extractors.

- **Content speakables (primary)**: the output of `npm run speakables -- --locale <locale> --json`
  in `content/` (`[{text, speak?, sources}]`). It has every string a kid can hear: titles, demo
  sentences, all prompt segments (which live in TypeScript) and the lexicon, including the
  single-locale reading tracks. The extractor looks for:
  1. a pre-generated `content/speakables.<locale>.json`,
  2. a live `npm run speakables` (when npm is installed, as on the host),
  3. `.cache/speakables.<locale>.json`, which `run.sh extract|all` writes on the host because the
     image has no Node. This file is ignored when `--content-dir` points elsewhere.
- **Content YAML (fallback)**: tolerant, because it predates the schema. Any mapping with both
  `de-CH` and `en-US` string values becomes two clips. A `speak:` field adds clips; it can be
  `{de-CH: ..., en-US: ...}` (strings or lists), or a string when a `locale:` key is in scope.
  `speak: false` on a mapping skips its whole subtree. Invalid files are logged and skipped. It
  misses the single-locale reading tracks and the prompt segments.
- **i18n JSON**: nested keys are joined with dots and matched against the globs in
  `speakable-i18n-keys.txt`. Strings with `{{ placeholders }}` are skipped.
- **Lexicon (fallback)**: reads `content/lexicon/<locale>.yaml` (canonical) and falls back to
  `tools/audio/lexicon/<locale>.yaml` when the content package is absent, for example in a bare
  checkout of this folder. Every string leaf is a clip. `{text, speak}` entries give a label
  (`"7"`, `"M"`) and the text the TTS reads (`"sieben"`, `"Em"`). The content lexicon is a
  superset; it starts with `speak: false` so the content YAML extractor skips it.
  `tests/test_speakables.py` fails if `tools/audio/lexicon` stops being a subset of it, so edit
  `content/lexicon` first. Isolated sounds are always rendered inside a carrier word ("M wie Maus",
  "M as in moon").

Extra extractors can be added with `murmeli_audio.extract.register_extractor(name, fn)`.

### Manifest

```json
{ "version": "<content hash>", "generatedAt": "...",
  "locales": { "de-CH": { "<key>": { "text": "7", "file": "de-CH/<key>.opus", "durationMs": 640,
    "engine": "qwen3", "voice": "de-CH-c1-…", "status": "ok|flagged|human", "sources": ["lexicon:numbers.7"] } } } }
```

`sources` lists the ids the clip was extracted from (for example `i18n:kid.feedback.great`), so
the frontend can look clips up by id as well as by text.

## Picking a voice

1. `./run.sh design-voice --count 3` (or `--locale de-CH`). Edit `voices/design.yaml` to change the
   brief or the reference sentence. Candidate ids include a hash of brief, seed and model revision.
2. Listen to `voices/<locale>/*/ref.wav`. `voices/selected.json` defaults to candidate 1 of each
   locale. Set it to the voice you like (`{"de-CH": "<voice_id>", "en-US": "<voice_id>"}`).
3. Run `./run.sh all`. A new voice changes every key, so everything is rendered again on purpose.

By default the Base model clones the reference clip fully, which copies its rhythm and pauses as well as
the voice. To keep only the voice colour, add `"clone_mode": "timbre"` to the voice's `meta.json`
(Qwen x-vector-only cloning; `ref_text` is then ignored). Put it in a new voice folder rather than
editing a selected one: the job key depends on the voice id, so only a new id renders the clips again.
`de-CH-c1-5f3596-timbre` is `de-CH-c1-5f3596` in timbre mode, chosen because the original reference
sentence is choppy.

Commit `voices/` (the reference clips are small) so every later render uses the same narrator.

## Human recordings

Isolated sounds and anything the TTS model can't get right can be recorded by a person:

1. Put a WAV file in `human/<locale>/<slug>.wav`.
2. Map the exact text to it in `human/overrides.yaml`:
   ```yaml
   de-CH:
     "M wie Maus": m-wie-maus.wav
   ```
3. Run `./run.sh postprocess && ./run.sh manifest`.

A recording takes precedence over the TTS clip with the same text: it keeps the job's key, gets
`status: "human"`, and isn't rendered or verified. It goes through the same trim, loudness and
Opus steps. Only record adults who have agreed in writing to the use of their voice.

## Engines

`TtsEngine` (`murmeli_audio/engines/base.py`) has `version`, `voice_id()` and
`synthesize(items, voice_id, seed)`. Engines are registered by name in `murmeli_audio/engines/__init__.py`.

- `qwen3` (primary): Qwen3-TTS 12Hz 1.7B Base clones the selected VoiceDesign reference clip
  (`create_voice_clone_prompt` + batched `generate_voice_clone`, bf16, SDPA attention). Voices with
  `"clone_mode": "timbre"` use x-vector-only cloning (see [Picking a voice](#picking-a-voice)).
- `piper` (CPU placeholder for development and CI): `de_DE-thorsten-medium` and
  `en_US-ljspeech-medium`. It ignores `voices/selected.json` and gives different keys than `qwen3`.
- `orpheus`: a stub for the planned fallback. It raises `NotImplementedError`.

## Licensing

| Component | License | Notes |
|---|---|---|
| Qwen3-TTS (`qwen-tts` package, 1.7B Base and VoiceDesign weights) | Apache-2.0 | Primary engine. Commercial use is allowed. |
| Fish Audio S2 Pro | Fish Audio Research License | **Excluded.** It is non-commercial, and the license restricts how the outputs may be used. |
| Orpheus TTS | Apache-2.0 | The planned fallback (not implemented). |
| Piper | MIT (original `rhasspy/piper`) | The maintained `piper-tts` package (1.3 and later, `OHF-Voice/piper1-gpl`) is **GPL-3.0**. It is only run as a separate process for development and CI, and its output is never shipped. Voices: thorsten is CC0, LJSpeech is public domain. |
| faster-whisper / CTranslate2 | MIT | ASR check only. |
| Whisper large-v3 weights | MIT | Systran's CTranslate2 conversion. |
| ffmpeg | LGPL/GPL | Used as a CLI tool only. |

The pipeline code is part of this repository. The generated clips belong to the project. Apache-2.0
puts no restrictions on model outputs.

## AI-voice disclosure

The narrator voices are synthetic. VoiceDesign creates them from a text description, and no real
person's voice is cloned. The app's About page must say that the voices are AI-generated (plan
§5a). Human recordings are marked `status: "human"` in the manifest.
