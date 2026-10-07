"""Small OpenAI-compatible client for local LM Studio inference."""

from __future__ import annotations

import os
from typing import Any, Mapping, Sequence

import httpx


class LLMProviderError(RuntimeError):
    """A provider request failed or returned an invalid completion."""


class LMStudioClient:
    """Call LM Studio's OpenAI-compatible chat-completions endpoint."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "lm-studio",
        timeout: float = 120.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout = timeout
        self.transport = transport

    async def complete(
        self,
        messages: Sequence[Mapping[str, str]],
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
    ) -> str:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": list(messages),
            "temperature": temperature,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=body,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise LLMProviderError(f"LM Studio request failed: {exc}") from exc

        if response.is_error:
            raise LLMProviderError(f"LM Studio returned HTTP {response.status_code}")

        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("LM Studio returned an invalid completion") from exc
        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError("LM Studio returned an empty completion")
        return content.strip()


def lm_studio_from_env() -> LMStudioClient:
    """Build a client from environment variables without loading secrets from logs."""

    model = os.getenv("AI_MODEL") or os.getenv("DEEPSEEK_MODEL")
    if not model:
        raise LLMProviderError("AI_MODEL is required when AI_PROVIDER=lmstudio")
    return LMStudioClient(
        base_url=os.getenv("AI_BASE_URL", "http://127.0.0.1:1234/v1"),
        model=model,
        api_key=os.getenv("AI_API_KEY", "lm-studio"),
        timeout=float(os.getenv("AI_TIMEOUT_SECONDS", "120")),
    )
