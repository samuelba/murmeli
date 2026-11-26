from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModelSpec:
    repo: str
    revision: str

    @property
    def short(self) -> str:
        return f"{self.repo.split('/')[-1]}@{self.revision[:8]}"


QWEN_TTS_PACKAGE = "qwen-tts==0.1.1"
QWEN_BASE = ModelSpec("Qwen/Qwen3-TTS-12Hz-1.7B-Base", "fd4b254389122332181a7c3db7f27e918eec64e3")
QWEN_DESIGN = ModelSpec("Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", "5ecdb67327fd37bb2e042aab12ff7391903235d3")
WHISPER = {
    "large-v3": ModelSpec("Systran/faster-whisper-large-v3", "edaa852ec7e145841d8ffdb056a99866b5f0a478"),
    "small": ModelSpec("Systran/faster-whisper-small", "536b0662742c02347bc0e980a01041f333bce120"),
}


def fetch(spec: ModelSpec, models_dir: Path) -> Path:
    from huggingface_hub import snapshot_download

    return Path(snapshot_download(spec.repo, revision=spec.revision, cache_dir=str(models_dir / "hf")))
