#!/usr/bin/env bash
# Runs the TTS pipeline in the GPU container. Usage:
#   ./run.sh build                 build the image
#   ./run.sh test [pytest args]    run pytest in the container
#   ./run.sh shell                 interactive shell in the container
#   ./run.sh <command> [args...]   python -m murmeli_audio <command> (extract, render, all, ...)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
IMAGE="${MURMELI_AUDIO_IMAGE:-murmeli-audio:latest}"
GPU_ARGS=(--gpus all)
[[ "${MURMELI_NO_GPU:-0}" == "1" ]] && GPU_ARGS=()

docker_run() {
  local tty=()
  [[ -t 0 && -t 1 ]] && tty=(-it)
  mkdir -p "$HERE/models" "$HERE/out" "$HERE/.cache"
  docker run --rm "${tty[@]}" "${GPU_ARGS[@]}" \
    --user "$(id -u):$(id -g)" \
    --security-opt label=disable \
    -v "$REPO:/repo:ro" \
    -v "$HERE:/repo/tools/audio" \
    -e MURMELI_MODELS_DIR=/repo/tools/audio/models \
    "$@"
}

# The image has no Node: write `npm run speakables` output to .cache for the extractor.
speakables_cache() {
  local content="$REPO/content"
  [[ -f "$content/package.json" ]] || return 0
  if ! command -v npm >/dev/null; then
    echo "run.sh: npm not found, extract falls back to the content YAML extractor" >&2
    return 0
  fi
  mkdir -p "$HERE/.cache"
  local locale out
  for locale in de-CH en-US; do
    out="$HERE/.cache/speakables.$locale.json"
    if (cd "$content" && npm run -s speakables -- --locale "$locale" --json) >"$out.tmp"; then
      mv "$out.tmp" "$out"
    else
      rm -f "$out.tmp" "$out"
      echo "run.sh: speakables for $locale failed, extract falls back to the content YAML extractor" >&2
    fi
  done
}

case " $* " in
  *" extract "* | *" all "*) speakables_cache ;;
esac

case "${1:-}" in
  build)
    docker build -t "$IMAGE" "$HERE"
    ;;
  test)
    shift
    docker_run --entrypoint python "$IMAGE" -m pytest -p no:cacheprovider "$@"
    ;;
  shell)
    docker_run --entrypoint bash "$IMAGE"
    ;;
  "" | -h | --help)
    sed -n '2,6p' "$0"
    ;;
  *)
    docker_run "$IMAGE" "$@"
    ;;
esac
