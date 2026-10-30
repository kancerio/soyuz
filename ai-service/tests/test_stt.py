import pytest
from fastapi.testclient import TestClient
import src.main as main

from src.llm_provider import LLMProviderError


client = TestClient(main.app)

def test_stt_mock():
    # Отправляем пустой файл, но заглушка всё равно вернёт фиктивный ответ
    files = {"audio": ("test.wav", b"fake audio data", "audio/wav")}
    data = {"language": "ru"}
    response = client.post("/stt", files=files, data=data)
    assert response.status_code == 200
    json_data = response.json()
    assert "recognized_text" in json_data
    assert "summary" in json_data


def test_stt_uses_configured_provider(monkeypatch):
    class FakeSpeechClient:
        async def transcribe(self, *, audio, filename, content_type, language):
            assert audio == b"real audio"
            assert filename == "voice.webm"
            assert content_type == "audio/webm"
            assert language == "ru"
            return "Распознанный текст"

    monkeypatch.setenv("STT_PROVIDER", "openai_compatible")
    monkeypatch.setattr(main, "get_stt_client", lambda: FakeSpeechClient())

    response = client.post(
        "/stt",
        files={"audio": ("voice.webm", b"real audio", "audio/webm")},
        data={"language": "ru"},
    )

    assert response.status_code == 200
    assert response.json()["transcript"] == "Распознанный текст"
    assert response.json()["recognized_text"] == "Распознанный текст"
    assert response.json()["provider"] == "openai_compatible"


def test_stt_rejects_empty_audio():
    response = client.post(
        "/stt",
        files={"audio": ("empty.wav", b"", "audio/wav")},
        data={"language": "ru"},
    )

    assert response.status_code == 422
    assert "empty" in response.text.lower()


def test_stt_rejects_audio_over_limit(monkeypatch):
    monkeypatch.setattr(main, "MAX_AUDIO_BYTES", 3)

    response = client.post(
        "/stt",
        files={"audio": ("large.wav", b"1234", "audio/wav")},
        data={"language": "ru"},
    )

    assert response.status_code == 413
    assert "too large" in response.text.lower()


def test_stt_reports_provider_failure(monkeypatch):
    def fail_provider():
        raise LLMProviderError("Whisper provider is offline")

    monkeypatch.setenv("STT_PROVIDER", "openai_compatible")
    monkeypatch.setattr(main, "get_stt_client", fail_provider)

    response = client.post(
        "/stt",
        files={"audio": ("voice.wav", b"audio", "audio/wav")},
        data={"language": "ru"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Whisper provider is offline"
