import asyncio
import json

import httpx
import pytest

from src.llm_provider import LLMProviderError, LMStudioClient


def test_lm_studio_client_sends_openai_compatible_request():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"role": "assistant", "content": "Готово"}}
                ]
            },
        )

    client = LMStudioClient(
        base_url="http://127.0.0.1:1234/v1",
        model="deepseek-local",
        api_key="lm-studio",
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(
        client.complete(
            [{"role": "user", "content": "Сделай короче: длинный текст"}],
            json_mode=True,
        )
    )

    assert result == "Готово"
    assert seen["url"] == "http://127.0.0.1:1234/v1/chat/completions"
    assert seen["body"]["model"] == "deepseek-local"
    assert seen["body"]["response_format"] == {"type": "json_object"}


def test_lm_studio_client_reports_http_errors():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="server unavailable")

    client = LMStudioClient(
        base_url="http://127.0.0.1:1234/v1",
        model="deepseek-local",
        api_key="lm-studio",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(LLMProviderError, match="LM Studio returned HTTP 503"):
        asyncio.run(client.complete([{"role": "user", "content": "Проверка"}]))
