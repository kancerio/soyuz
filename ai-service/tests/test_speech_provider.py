import asyncio
import json

import httpx
import pytest

from src.llm_provider import (
    OpenAICompatibleSTTClient,
    SpeechProviderTimeout,
)


def test_openai_compatible_stt_client_sends_multipart_audio():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["content_type"] = request.headers["content-type"]
        seen["body"] = request.content
        return httpx.Response(200, json={"text": "Расшифровка"})

    client = OpenAICompatibleSTTClient(
        base_url="http://whisper.local/v1",
        model="whisper-1",
        api_key="test-key",
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(
        client.transcribe(
            audio=b"wav bytes",
            filename="voice.wav",
            content_type="audio/wav",
            language="ru",
        )
    )

    assert result == "Расшифровка"
    assert seen["url"] == "http://whisper.local/v1/audio/transcriptions"
    assert "multipart/form-data" in seen["content_type"]
    assert b"whisper-1" in seen["body"]
    assert b"wav bytes" in seen["body"]


def test_openai_compatible_stt_client_preserves_gateway_timeout():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(504, json={"detail": "Whisper transcription timed out"})

    client = OpenAICompatibleSTTClient(
        base_url="http://whisper.local/v1",
        model="whisper-1",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(SpeechProviderTimeout, match="Speech provider timed out"):
        asyncio.run(
            client.transcribe(
                audio=b"wav bytes",
                filename="voice.wav",
                content_type="audio/wav",
                language="ru",
            )
        )

