"""Small OpenAI-compatible server for a local faster-whisper model.

This process is intentionally separate from the text AI service: LM Studio
serves the Qwen text model, while this optional process serves audio
transcriptions on ``/v1/audio/transcriptions``.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
import uvicorn


MODEL_NAME = os.getenv("WHISPER_MODEL", "Systran/faster-whisper-base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv(
    "WHISPER_COMPUTE_TYPE",
    "int8" if DEVICE == "cpu" else "float16",
)
HOST = os.getenv("WHISPER_HOST", "0.0.0.0")
PORT = int(os.getenv("WHISPER_PORT", "9000"))

app = FastAPI(title="Soyuz local Whisper adapter")
_model: Any | None = None


def get_model() -> Any:
    """Load the model once, keeping the heavy optional dependency out of imports."""

    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "faster-whisper is required; install ai-service/requirements-stt-local.txt"
            ) from exc
        _model = WhisperModel(
            MODEL_NAME,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
        )
    return _model


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper-1"),
    language: str | None = Form(None),
) -> dict[str, str]:
    del model  # The selected local model is configured by WHISPER_MODEL.
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=422, detail="audio must not be empty")

    suffix = Path(file.filename or "audio").suffix or ".audio"
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(audio)
            temporary_path = temporary.name

        segments, info = get_model().transcribe(
            temporary_path,
            language=language or None,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
        if not text:
            raise HTTPException(status_code=422, detail="Whisper returned an empty transcript")
        return {"text": text, "language": getattr(info, "language", language or "")}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Whisper transcription failed") from exc
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass


if __name__ == "__main__":  # pragma: no cover - process entry point
    uvicorn.run(app, host=HOST, port=PORT)
