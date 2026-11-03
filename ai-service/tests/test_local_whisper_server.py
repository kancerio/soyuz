from fastapi.testclient import TestClient

import tools.local_whisper_server as server

client = TestClient(server.app)


def test_local_whisper_server_returns_openai_transcription_shape(monkeypatch):
    class FakeSegment:
        def __init__(self, text):
            self.text = text

    class FakeInfo:
        language = "ru"

    class FakeModel:
        def transcribe(self, path, *, language, vad_filter):
            assert path.endswith(".wav")
            assert language == "ru"
            assert vad_filter is True
            return iter([FakeSegment(" Привет"), FakeSegment(" мир ")]), FakeInfo()

    monkeypatch.setattr(server, "_model", FakeModel())

    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("sample.wav", b"audio", "audio/wav")},
        data={"model": "whisper-1", "language": "ru"},
    )

    assert response.status_code == 200
    assert response.json() == {"text": "Привет мир", "language": "ru"}


def test_local_whisper_server_rejects_empty_audio():
    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("sample.wav", b"", "audio/wav")},
    )

    assert response.status_code == 422


def test_local_whisper_server_returns_gateway_timeout_for_slow_inference(monkeypatch):
    import time

    class FakeSegment:
        text = "Текст"

    class FakeInfo:
        language = "ru"

    class SlowModel:
        def transcribe(self, *_args, **_kwargs):
            time.sleep(0.05)
            return iter([FakeSegment()]), FakeInfo()

    monkeypatch.setattr(
        server, "WHISPER_INFERENCE_TIMEOUT_SECONDS", 0.001, raising=False
    )
    monkeypatch.setattr(server, "_model", SlowModel())

    response = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("sample.wav", b"audio", "audio/wav")},
    )

    assert response.status_code == 504
    assert response.json()["detail"] == "Whisper transcription timed out"
