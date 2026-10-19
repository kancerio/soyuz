import json

from fastapi.testclient import TestClient

import src.main as main


client = TestClient(main.app)


MESSAGES = [
    {
        "sender_id": "u1",
        "text": "Перенесём релиз на четверг?",
        "timestamp": "2026-10-07T10:00:00Z",
    },
    {
        "sender_id": "u2",
        "text": "Согласен, я проверю миграцию.",
        "timestamp": "2026-10-07T10:01:00Z",
    },
]


def test_summary_mock_returns_structured_contract():
    response = client.post("/summary", json={"messages": MESSAGES, "language": "ru"})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"summary", "decisions", "participants", "language", "provider"}
    assert body["summary"]
    assert body["participants"] == ["u1", "u2"]
    assert body["provider"] == "mock"


def test_summarize_alias_keeps_the_same_contract():
    response = client.post("/summarize", json={"messages": MESSAGES})

    assert response.status_code == 200
    assert set(response.json()) == {
        "summary",
        "decisions",
        "participants",
        "language",
        "provider",
    }


def test_summary_rejects_empty_messages():
    response = client.post("/summary", json={"messages": []})

    assert response.status_code == 422
    assert "messages" in response.text


def test_summary_rejects_too_many_messages():
    messages = [
        {"sender_id": "u1", "text": f"Сообщение {index}"}
        for index in range(101)
    ]

    response = client.post("/summary", json={"messages": messages})

    assert response.status_code == 422
    assert "100" in response.text


def test_summary_uses_configured_llm(monkeypatch):
    class FakeClient:
        async def complete(self, messages, **kwargs):
            assert kwargs["json_mode"] is True
            assert "Перенесём релиз" in messages[-1]["content"]
            return json.dumps(
                {
                    "summary": "Релиз перенесён на четверг.",
                    "decisions": ["релиз в четверг"],
                    "participants": ["u1", "u2"],
                },
                ensure_ascii=False,
            )

    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())

    response = client.post("/summary", json={"messages": MESSAGES})

    assert response.status_code == 200
    assert response.json()["summary"] == "Релиз перенесён на четверг."
    assert response.json()["provider"] == "lmstudio"


def test_summary_reports_invalid_provider_output(monkeypatch):
    class FakeClient:
        async def complete(self, messages, **kwargs):
            return "это не JSON"

    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())

    response = client.post("/summary", json={"messages": MESSAGES})

    assert response.status_code == 502
    assert "structured summary" in response.json()["detail"]


def test_summary_accepts_json_like_provider_output(monkeypatch):
    class FakeClient:
        async def complete(self, messages, **kwargs):
            return '{summary:"Готово", decisions:["Выполнить"], participants:["u1"]}'

    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())

    response = client.post("/summary", json={"messages": MESSAGES})

    assert response.status_code == 200
    assert response.json()["summary"] == "Готово"
    assert response.json()["decisions"] == ["Выполнить"]
