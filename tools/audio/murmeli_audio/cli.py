from __future__ import annotations

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from . import engines, pipeline
from .config import LOCALES, Paths
from .pipeline import Context


def _paths(args: argparse.Namespace) -> Paths:
    return Paths(content_override=args.content_dir, i18n_override=args.i18n_dir)


def _transcriber(args: argparse.Namespace, ctx: Context) -> pipeline.Transcriber:
    from .asr import WhisperTranscriber

    return WhisperTranscriber(ctx.paths, model=args.model, device=args.asr_device)


def _verify_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", default="large-v3", help="faster-whisper model (large-v3, small, ...)")
    parser.add_argument("--asr-device", default="auto", help="auto, cuda or cpu")
    parser.add_argument("--threshold", type=float, default=0.15, help="max WER for multi-word clips")
    parser.add_argument("--retries", type=int, default=3, help="re-renders with a new seed before flagging")


def _render_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--only", action="append", default=[], help="glob on job key, text or source id")
    parser.add_argument("--only-file", type=Path, help="file with one --only glob per line")
    parser.add_argument("--limit", type=int, help="render at most N jobs")
    parser.add_argument("--batch-size", type=int, help="clips per engine call")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="murmeli_audio", description="Offline TTS pipeline")
    parser.add_argument("--engine", default="qwen3", choices=engines.available())
    parser.add_argument("--device", default="cuda:0", help="torch device for the TTS model")
    parser.add_argument("--seed", type=int, default=1234, help="base sampling seed")
    parser.add_argument("--content-dir", type=Path, help="override <repo>/content")
    parser.add_argument("--i18n-dir", type=Path, help="override <repo>/frontend/public/i18n")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    extract = sub.add_parser("extract", help="collect speakable strings into jobs.jsonl")
    extract.add_argument(
        "--source",
        action="append",
        default=[],
        help="speakables, content, i18n or lexicon (default: speakables + i18n, else YAML fallback)",
    )
    design = sub.add_parser("design-voice", help="create candidate narrator voices (Qwen VoiceDesign)")
    design.add_argument("--locale", action="append", choices=LOCALES, default=[])
    design.add_argument("--count", type=int, default=3)
    _render_args(sub.add_parser("render", help="render uncached jobs"))
    verify = sub.add_parser("verify", help="ASR check, re-render failures, flag the rest")
    _verify_args(verify)
    verify.add_argument("--force", action="store_true", help="re-check clips that were already verified")
    verify.add_argument(
        "--rescore", action="store_true", help="re-score stored transcripts of flagged clips, no ASR"
    )
    post = sub.add_parser("postprocess", help="trim, loudnorm, encode Opus")
    post.add_argument("--force", action="store_true")
    sub.add_parser("manifest", help="write out/manifest.json")
    sub.add_parser("review", help="write out/review.html")
    everything = sub.add_parser("all", help="extract, render, verify, postprocess, manifest, review")
    _render_args(everything)
    _verify_args(everything)
    reroll = sub.add_parser("reroll", help="re-render clips with a new seed and re-check them")
    reroll.add_argument("keys", nargs="+")
    _verify_args(reroll)
    approve = sub.add_parser("approve", help="mark clips as ok after listening")
    approve.add_argument("keys", nargs="+")
    return parser


def _only(args: argparse.Namespace) -> list[str]:
    patterns = list(args.only)
    if args.only_file:
        lines = args.only_file.read_text(encoding="utf-8").splitlines()
        patterns += [ln.split("#", 1)[0].strip() for ln in lines if ln.split("#", 1)[0].strip()]
    return patterns


def run(args: argparse.Namespace) -> int:
    ctx = Context(paths=_paths(args), engine=args.engine, device=args.device, seed=args.seed)
    command = args.command
    if command == "extract":
        pipeline.run_extract(ctx, args.source)
    elif command == "design-voice":
        from .voice_design import design_voices

        created = design_voices(ctx.paths, args.locale or list(LOCALES), args.count, ctx.seed, ctx.device)
        print(created)
    elif command == "render":
        pipeline.run_render(ctx, _only(args), args.limit, args.batch_size)
    elif command == "verify" and args.rescore:
        pipeline.run_rescore(ctx, args.threshold)
    elif command == "verify":
        pipeline.run_verify(ctx, _transcriber(args, ctx), args.threshold, args.retries, args.force)
    elif command == "postprocess":
        pipeline.run_postprocess(ctx, args.force)
    elif command == "manifest":
        pipeline.run_manifest(ctx)
    elif command == "review":
        pipeline.run_review(ctx)
    elif command == "all":
        pipeline.run_extract(ctx)
        pipeline.run_render(ctx, _only(args), args.limit, args.batch_size)
        pipeline.run_verify(ctx, _transcriber(args, ctx), args.threshold, args.retries)
        pipeline.finish(ctx)
    elif command == "reroll":
        pipeline.run_reroll(ctx, args.keys, _transcriber(args, ctx), args.threshold)
    elif command == "approve":
        pipeline.run_approve(ctx, args.keys)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        return run(args)
    except (FileNotFoundError, KeyError, ValueError, NotImplementedError) as exc:
        logging.getLogger("murmeli_audio").error("%s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
