import pytest
from fastapi.testclient import TestClient
import src.main as main
from src.main import app

client = TestClient(app)

def test_assist_shorten():
    payload = {
        "prompt": "This is a very long text that needs to be shortened to a few words.",
        "action": "shorten"
    }
    response = client.post("/assist", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    assert "Кратко:" in data["result"]

def test_assist_formal():
    payload = {
        "prompt": "You are stupid.",
        "action": "formal"
    }
    response = client.post("/assist", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Формально:" in data["result"]


def test_assist_uses_lm_studio_when_configured(monkeypatch):
    class FakeClient:
        async def complete(self, messages, **kwargs):
            assert "friendly" in messages[-1]["content"]
            return "Привет! Буду рад помочь."

    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient(), raising=False)

    response = client.post(
        "/assist",
        json={"prompt": "Помоги с задачей", "action": "friendly"},
    )

    assert response.status_code == 200
    assert response.json()["result"] == "Привет! Буду рад помочь."


def test_assist_response_uses_same_result_contract():
    response = client.post(
        "/assist",
        json={"prompt": "Сделай мягче", "action": "friendly"},
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "result",
        "original_text",
        "translated_text",
        "source_lang",
        "target_lang",
        "action",
    }
    assert body["action"] == "friendly"


def test_assist_rejects_unknown_action():
    response = client.post(
        "/assist",
        json={"prompt": "Текст", "action": "change_tone"},
    )

    assert response.status_code == 422
    assert "shorten" in response.text


def test_assist_rejects_empty_prompt():
    response = client.post(
        "/assist",
        json={"prompt": " ", "action": "shorten"},
    )

    assert response.status_code == 422
    assert "prompt" in response.text


def test_assist_rejects_prompt_over_limit():
    response = client.post(
        "/assist",
        json={"prompt": "x" * 5001, "action": "shorten"},
    )

    assert response.status_code == 422
    assert "5000" in response.text
