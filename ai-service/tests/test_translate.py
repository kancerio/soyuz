import pytest
from fastapi.testclient import TestClient
import src.main as main
from src.main import app
from src.llm_provider import LLMProviderError

client = TestClient(app)

def test_translate():
    payload = {
        "text": "Hello world",
        "source_lang": "en",
        "target_lang": "ru"
    }
    response = client.post("/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "translated_text" in data
    assert data["result"] == data["translated_text"]
    assert data["original_text"] == "Hello world"
    assert data["source_lang"] == "en"
    assert data["target_lang"] == "ru"


def test_translate_uses_lm_studio_when_configured(monkeypatch):
    class FakeClient:
        async def complete(self, messages, **kwargs):
            assert messages[-1]["role"] == "user"
            return "Привет, мир"

    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient(), raising=False)

    response = client.post(
        "/translate",
        json={"text": "Hello world", "source_lang": "en", "target_lang": "ru"},
    )

    assert response.status_code == 200
    assert response.json()["translated_text"] == "Привет, мир"


def test_translate_rejects_empty_text():
    response = client.post(
        "/translate",
        json={"text": "   ", "source_lang": "en", "target_lang": "ru"},
    )

    assert response.status_code == 422
    assert "text" in response.text


def test_translate_rejects_text_over_limit():
    response = client.post(
        "/translate",
        json={"text": "x" * 5001, "source_lang": "en", "target_lang": "ru"},
    )

    assert response.status_code == 422
    assert "5000" in response.text


def test_translate_reports_provider_failure(monkeypatch):
    def fail_provider():
        raise LLMProviderError("LM Studio is offline")

    monkeypatch.setattr(main, "get_llm_client", fail_provider)
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    response = client.post(
        "/translate",
        json={"text": "Hello", "source_lang": "en", "target_lang": "ru"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "LM Studio is offline"
