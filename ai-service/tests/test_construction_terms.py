import json

from fastapi.testclient import TestClient

import src.main as main
from src.llm_provider import LLMProviderTimeout, ProviderUnavailableError


client = TestClient(main.app)


def test_construction_terms_mock_returns_empty_unlinked_contract(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "true")

    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "en",
            "country_code": "RU",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "terms": [],
        "source_language": "ru",
        "response_language": "en",
        "country_code": "RU",
        "provider": "mock",
        "mock": True,
        "correlation_id": body["correlation_id"],
    }


def test_construction_terms_real_response_has_source_backed_span_and_ui_language(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, messages, **kwargs):
            prompt = messages[-1]["content"]
            assert kwargs["json_mode"] is True
            if "Нужно проверить армирование стены." in prompt:
                return json.dumps({"terms": ["армирование"]}, ensure_ascii=False)
            assert "армирование" in prompt
            assert "source excerpt" in prompt.lower()
            assert "English" in prompt
            return json.dumps(
                {"definitions": [{"term": "армирование", "definition": "Steel reinforcement embedded in concrete to improve its tensile strength."}]},
                ensure_ascii=False,
            )

    async def search_source(term, source_language, country_code):
        assert (term, source_language, country_code) == ("армирование", "ru", "RU")
        return {
            "title": "Армирование",
            "url": "https://ru.wikipedia.org/wiki/Армирование",
            "extract": "Армирование — способ усиления строительных конструкций стальными элементами.",
            "language": "ru",
        }

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", search_source, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "en",
            "country_code": "RU",
        },
        headers={"X-Correlation-ID": "term-test-1"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "terms": [
            {
                "term": "армирование",
                "start": 16,
                "end": 27,
                "definition": "Steel reinforcement embedded in concrete to improve its tensile strength.",
                "country_code": "RU",
                "source_title": "Армирование",
                "source_url": "https://ru.wikipedia.org/wiki/Армирование",
                "source_language": "ru",
            }
        ],
        "source_language": "ru",
        "response_language": "en",
        "country_code": "RU",
        "provider": "lmstudio",
        "mock": False,
        "correlation_id": "term-test-1",
    }


def test_construction_terms_does_not_return_model_terms_absent_from_message(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, messages, **kwargs):
            return json.dumps({"terms": ["асфальтобетон"]}, ensure_ascii=False)

    async def search_source(*_args):
        raise AssertionError("terms absent from the message must not be searched")

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", search_source, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "ru",
            "country_code": "RU",
        },
    )

    assert response.status_code == 200
    assert response.json()["terms"] == []
    assert response.json()["mock"] is False


def test_construction_terms_does_not_create_an_uncited_definition(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, *_args, **_kwargs):
            return json.dumps({"terms": ["армирование"]}, ensure_ascii=False)

    async def no_source(*_args):
        return None

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", no_source, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "ru",
            "country_code": "RU",
        },
    )

    assert response.status_code == 200
    assert response.json()["terms"] == []


def test_construction_terms_offsets_are_javascript_utf16_units(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")
    text = "🏗️ Нужно проверить армирование стены."

    class FakeClient:
        async def complete(self, messages, **kwargs):
            prompt = messages[-1]["content"]
            if text in prompt:
                return json.dumps({"terms": ["армирование"]}, ensure_ascii=False)
            return json.dumps(
                {"definitions": [{"term": "армирование", "definition": "Объяснение по источнику."}]},
                ensure_ascii=False,
            )

    async def search_source(*_args):
        return {
            "title": "Армирование",
            "url": "https://ru.wikipedia.org/wiki/Армирование",
            "extract": "Армирование — способ усиления конструкций.",
            "language": "ru",
        }

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", search_source, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": text,
            "source_language": "ru",
            "response_language": "ru",
            "country_code": "RU",
        },
    )

    assert response.status_code == 200
    assert response.json()["terms"][0]["start"] == 20
    assert response.json()["terms"][0]["end"] == 31


def test_construction_terms_maps_reference_search_unavailable_to_503(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, *_args, **_kwargs):
            return json.dumps({"terms": ["армирование"]}, ensure_ascii=False)

    async def unavailable(*_args):
        raise ProviderUnavailableError("Reference search is unavailable")

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", unavailable, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "ru",
            "country_code": "RU",
        },
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "provider_unavailable"


def test_construction_terms_maps_reference_search_timeout_to_504(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, *_args, **_kwargs):
            return json.dumps({"terms": ["армирование"]}, ensure_ascii=False)

    async def timed_out(*_args):
        raise LLMProviderTimeout("Construction reference search timed out")

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    monkeypatch.setattr(main, "search_wikipedia_term", timed_out, raising=False)
    response = client.post(
        "/construction-terms",
        json={
            "text": "Нужно проверить армирование стены.",
            "source_language": "ru",
            "response_language": "ru",
            "country_code": "RU",
        },
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "provider_timeout"


def test_construction_terms_rejects_unsupported_ui_language():
    response = client.post(
        "/construction-terms",
        json={
            "text": "Check the rebar.",
            "source_language": "en",
            "response_language": "xx",
            "country_code": "US",
        },
    )

    assert response.status_code == 422
    assert "response_language" in response.text


def test_construction_terms_rejects_invalid_country_code():
    response = client.post(
        "/construction-terms",
        json={
            "text": "Check the rebar.",
            "source_language": "en",
            "response_language": "en",
            "country_code": "USA",
        },
    )

    assert response.status_code == 422
    assert "country_code" in response.text


def test_construction_terms_maps_lm_studio_unavailable_to_503(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, *_args, **_kwargs):
            raise ProviderUnavailableError("LM Studio is unavailable")

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    response = client.post(
        "/construction-terms",
        json={
            "text": "Check the rebar.",
            "source_language": "en",
            "response_language": "en",
            "country_code": "US",
        },
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_provider_unavailable"


def test_construction_terms_maps_lm_studio_timeout_to_504(monkeypatch):
    monkeypatch.setenv("AI_MOCK_MODE", "false")
    monkeypatch.setenv("AI_PROVIDER", "lmstudio")

    class FakeClient:
        async def complete(self, *_args, **_kwargs):
            raise LLMProviderTimeout("LM Studio request timed out")

    monkeypatch.setattr(main, "get_llm_client", lambda: FakeClient())
    response = client.post(
        "/construction-terms",
        json={
            "text": "Check the rebar.",
            "source_language": "en",
            "response_language": "en",
            "country_code": "US",
        },
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "provider_timeout"
