# GPU image for the offline TTS pipeline: Python 3.12, PyTorch 2.9.1 (CUDA 12.8, Blackwell sm_120),
# qwen-tts, faster-whisper, piper and ffmpeg 7 (Debian trixie; bookworm's ffmpeg 5.1 loudnorm breaks on
# clips shorter than 3 s). The source is bind-mounted at runtime (see run.sh).
FROM python:3.12-slim-trixie

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg sox libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /usr/local/bin/uv

COPY requirements-gpu.lock /tmp/requirements-gpu.lock
RUN uv pip install --system --index-strategy unsafe-best-match -r /tmp/requirements-gpu.lock

ENV SITE=/usr/local/lib/python3.12/site-packages
ENV LD_LIBRARY_PATH=${SITE}/nvidia/cublas/lib:${SITE}/nvidia/cudnn/lib \
    HOME=/tmp \
    NUMBA_CACHE_DIR=/tmp/numba \
    HF_HUB_DISABLE_TELEMETRY=1 \
    PYTHONPATH=/repo/tools/audio

WORKDIR /repo/tools/audio
ENTRYPOINT ["python", "-m", "murmeli_audio"]
