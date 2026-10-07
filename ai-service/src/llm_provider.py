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
        reasoning_effort: str | None = None,
        max_tokens: int | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout = timeout
        self.reasoning_effort = reasoning_effort
        self.max_tokens = max_tokens
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
        if self.reasoning_effort:
            body["reasoning_effort"] = self.reasoning_effort
        if self.max_tokens is not None and self.max_tokens > 0:
            body["max_tokens"] = self.max_tokens
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
                # Some OpenAI-compatible local servers (including LM Studio
                # with Qwen models) reject the legacy json_object hint. Try
                # the newer JSON Schema form before falling back to the
                # prompt-only request.
                if response.status_code == 400 and json_mode:
                    fallback_body = dict(body)
                    fallback_body["response_format"] = {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "structured_response",
                            "strict": False,
                            "schema": {
                                "type": "object",
                                "additionalProperties": True,
                            },
                        },
                    }
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=fallback_body,
                        headers=headers,
                    )
                    if response.status_code == 400:
                        fallback_body.pop("response_format", None)
                        response = await client.post(
                            f"{self.base_url}/chat/completions",
                            json=fallback_body,
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


class OpenAICompatibleSTTClient:
    """Call an OpenAI-compatible Whisper transcription endpoint."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "",
        timeout: float = 120.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.timeout = timeout
        self.transport = transport

    async def transcribe(
        self,
        *,
        audio: bytes,
        filename: str,
        content_type: str,
        language: str,
    ) -> str:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        files = {"file": (filename, audio, content_type)}
        data = {"model": self.model, "language": language}

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.post(
                    f"{self.base_url}/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data,
                )
        except httpx.TimeoutException as exc:
            raise LLMProviderError("Speech provider timed out") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(f"Speech provider request failed: {exc}") from exc

        if response.is_error:
            raise LLMProviderError(
                f"Speech provider returned HTTP {response.status_code}"
            )

        try:
            payload = response.json()
            transcript = payload["text"]
        except (ValueError, KeyError, TypeError) as exc:
            raise LLMProviderError("Speech provider returned an invalid transcript") from exc
        if not isinstance(transcript, str) or not transcript.strip():
            raise LLMProviderError("Speech provider returned an empty transcript")
        return transcript.strip()


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
        reasoning_effort=(os.getenv("AI_REASONING_EFFORT", "none").strip() or None),
        max_tokens=int(os.getenv("AI_MAX_TOKENS", "512")),
    )
