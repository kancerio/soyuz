import pytest
from fastapi.testclient import TestClient

from src.main import MAX_TEXT_LENGTH, app

client = TestClient(app)
EXPECTED_RESPONSE_FIELDS = {
    "input_text",
    "result",
    "action",
    "source_lang",
    "target_lang",
    "correlation_id",
    "mock",
}


@pytest.mark.parametrize(
    ("action", "expected_result"),
    [
        ("shorten", "A short message"),
        ("formal", "[formal] A short message"),
        ("friendly", "[friendly] A short message"),
    ],
)
def test_assist_actions_use_shared_contract(monkeypatch, action, expected_result):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    response = client.post(
        "/assist", json={"text": "A short message", "action": action}
    )

    assert response.status_code == 200
    data = response.json()
    assert set(data) == EXPECTED_RESPONSE_FIELDS
    assert data["input_text"] == "A short message"
    assert data["result"] == expected_result
    assert data["action"] == action
    assert data["source_lang"] is None
    assert data["target_lang"] is None
    assert data["correlation_id"]
    assert data["mock"] is True


def test_assist_shorten_truncates_long_text(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    text = "word " * 40
    response = client.post("/assist", json={"text": text, "action": "shorten"})

    assert response.status_code == 200
    assert len(response.json()["result"]) <= 160
    assert response.json()["result"].endswith("...")


def test_assist_accepts_legacy_prompt_field(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    response = client.post(
        "/assist", json={"prompt": "Legacy client text", "action": "friendly"}
    )

    assert response.status_code == 200
    assert response.json()["input_text"] == "Legacy client text"


@pytest.mark.parametrize(
    ("payload", "field", "message"),
    [
        ({"text": "   ", "action": "shorten"}, "text", "Text must not be empty"),
        (
            {"text": "x" * (MAX_TEXT_LENGTH + 1), "action": "shorten"},
            "text",
            "at most 5000 characters",
        ),
        (
            {"text": "Hello", "action": "change_tone"},
            "action",
            "shorten",
        ),
    ],
)
def test_assist_rejects_invalid_input(payload, field, message):
    response = client.post("/assist", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert any(
        detail["field"] == field and message in detail["message"]
        for detail in body["error"]["details"]
    )
