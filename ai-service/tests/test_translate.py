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


def test_translate_uses_shared_contract_and_correlation_id(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    response = client.post(
        "/translate",
        json={"text": "Hello world", "source_lang": "en", "target_lang": "ru"},
        headers={"X-Correlation-ID": "translate-test-1"},
    )

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] == "translate-test-1"
    assert response.json() == {
        "input_text": "Hello world",
        "result": "[mock en->ru] Hello world",
        "action": "translate",
        "source_lang": "en",
        "target_lang": "ru",
        "correlation_id": "translate-test-1",
        "mock": True,
    }
    assert set(response.json()) == EXPECTED_RESPONSE_FIELDS


def test_translate_defaults_source_language_to_auto(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    response = client.post("/translate", json={"text": "Bonjour", "target_lang": "en"})

    assert response.status_code == 200
    assert response.json()["source_lang"] == "auto"


def test_translate_and_assist_share_openapi_response_model():
    schema = app.openapi()
    translate_response = schema["paths"]["/translate"]["post"]["responses"]["200"]
    assist_response = schema["paths"]["/assist"]["post"]["responses"]["200"]

    assert translate_response["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/TextOperationResponse"
    }
    assert assist_response["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/TextOperationResponse"
    }


def test_translate_rejects_empty_text():
    response = client.post(
        "/translate", json={"text": "   ", "source_lang": "en", "target_lang": "ru"}
    )

    assert_validation_error(response, "text", "Text must not be empty")


def test_translate_rejects_text_over_limit():
    response = client.post(
        "/translate",
        json={"text": "x" * (MAX_TEXT_LENGTH + 1), "target_lang": "ru"},
    )

    assert_validation_error(response, "text", "at most 5000 characters")


def test_translate_rejects_unsupported_language():
    response = client.post(
        "/translate", json={"text": "Hello", "source_lang": "en", "target_lang": "xx"}
    )

    assert_validation_error(response, "target_lang", "Unsupported language 'xx'")


def test_translate_returns_503_when_mock_is_disabled(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    response = client.post(
        "/translate", json={"text": "Hello", "source_lang": "en", "target_lang": "ru"}
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_provider_unavailable"


def test_translate_logs_metadata_without_text(monkeypatch, caplog):
    monkeypatch.setenv("AI_MOCK_MODE", "true")
    secret_text = "private-message-never-log"

    with caplog.at_level("INFO", logger="soyuz.ai"):
        response = client.post(
            "/translate",
            json={"text": secret_text, "source_lang": "en", "target_lang": "ru"},
        )

    assert response.status_code == 200
    assert "action=translate" in caplog.text
    assert "text_length=25" in caplog.text
    assert secret_text not in caplog.text


def assert_validation_error(response, field: str, message: str) -> None:
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["correlation_id"]
    assert any(
        detail["field"] == field and message in detail["message"]
        for detail in body["error"]["details"]
    )
