import asyncio
import json
import logging
import os
import re
from time import perf_counter
from typing import Any, Literal, Optional
from uuid import uuid4

import uvicorn
from fastapi import File, Form, FastAPI, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from .llm_provider import (
    LLMProviderError,
    LLMProviderTimeout,
    OpenAICompatibleSTTClient,
    ProviderUnavailableError,
    SpeechProviderTimeout,
    lm_studio_from_env,
)
from .reference_search import search_wikipedia_term

MAX_TEXT_LENGTH = 5_000
MAX_CONTEXT_LENGTH = 10_000
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(25 * 1024 * 1024)))
MAX_SUMMARY_MESSAGES = int(os.getenv("MAX_SUMMARY_MESSAGES", "100"))
SUPPORTED_LANGUAGES = frozenset({
    "ru", "en", "de", "fr", "es", "zh", "ar", "pt", "it", "nl", "pl",
    "uk", "tr", "ja", "ko", "hi", "fa", "sv", "da", "no", "fi", "cs",
    "el", "he", "id", "vi", "th",
})
SUPPORTED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
}
SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".mpeg", ".webm", ".ogg", ".m4a"}
CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

logging.basicConfig(
    level=getattr(logging, os.getenv("AI_LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("soyuz.ai")

app = FastAPI(title="AI Service for Messenger", version="0.3.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "AI_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ServiceUnavailableError(RuntimeError):
    """Raised when live inference was requested without a configured provider."""


def _clean_text(value: object, field: str) -> str:
    if not isinstance(value, str):
        return value  # type: ignore[return-value]
    normalized = value.strip()
    if not normalized:
        raise PydanticCustomError(
            "empty_text", f"{field.capitalize()} must not be empty"
        )
    if len(normalized) > MAX_TEXT_LENGTH:
        raise PydanticCustomError(
            "text_too_long",
            f"{field.capitalize()} must be at most {MAX_TEXT_LENGTH} characters",
        )
    return normalized


def _clean_language(
    value: object,
    field: str = "language",
    *,
    allow_auto: bool = False,
) -> str:
    if not isinstance(value, str):
        return value  # type: ignore[return-value]
    normalized = value.strip().lower()
    allowed = SUPPORTED_LANGUAGES | ({"auto"} if allow_auto else set())
    if normalized not in allowed:
        supported = ", ".join(sorted(allowed))
        raise PydanticCustomError(
            "unsupported_language",
            f"Unsupported language '{normalized}'. Supported values: {supported}",
        )
    return normalized


def _flag_enabled(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def mock_mode_enabled() -> bool:
    configured = os.getenv("AI_MOCK_MODE")
    if configured is not None:
        return _flag_enabled(configured)
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()
    return provider in {"", "mock"}


def ai_provider_name() -> str:
    if mock_mode_enabled():
        return "mock"
    return os.getenv("AI_PROVIDER", "").strip().lower() or "unknown"


def get_correlation_id(request: Request) -> str:
    return getattr(request.state, "correlation_id", str(uuid4()))


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    supplied = request.headers.get("X-Correlation-ID", "")
    request.state.correlation_id = (
        supplied if CORRELATION_ID_PATTERN.fullmatch(supplied) else str(uuid4())
    )
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = request.state.correlation_id
    return response


class TranslateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    source_lang: str = "auto"
    target_lang: str

    @field_validator("text")
    @classmethod
    def text_is_valid(cls, value: str) -> str:
        return _clean_text(value, "text")

    @field_validator("source_lang")
    @classmethod
    def source_language_is_supported(cls, value: str) -> str:
        return _clean_language(value, "source_lang", allow_auto=True)

    @field_validator("target_lang")
    @classmethod
    def target_language_is_supported(cls, value: str) -> str:
        return _clean_language(value, "target_lang")


class AssistRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    action: Literal["shorten", "formal", "friendly"]
    context: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_prompt(cls, value: Any) -> Any:
        if isinstance(value, dict) and "prompt" in value:
            value = dict(value)
            if "text" not in value:
                value["text"] = value["prompt"]
            value.pop("prompt", None)
        return value

    @field_validator("text")
    @classmethod
    def text_is_valid(cls, value: str) -> str:
        return _clean_text(value, "text")

    @field_validator("context")
    @classmethod
    def context_is_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if len(normalized) > MAX_CONTEXT_LENGTH:
            raise PydanticCustomError(
                "context_too_long",
                f"Context must be at most {MAX_CONTEXT_LENGTH} characters",
            )
        return normalized


class TextOperationResponse(BaseModel):
    input_text: str
    result: str
    action: Literal["translate", "shorten", "formal", "friendly"]
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    correlation_id: str
    mock: bool


AIResponse = TextOperationResponse


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorContent(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = []


class ErrorResponse(BaseModel):
    error: ErrorContent
    correlation_id: str


class SummaryMessage(BaseModel):
    sender_id: str
    text: str
    timestamp: Optional[str] = None

    @field_validator("sender_id", "text")
    @classmethod
    def message_text_is_valid(cls, value: str, info) -> str:
        return _clean_text(value, info.field_name)


class SummaryRequest(BaseModel):
    messages: list[SummaryMessage]
    language: str = "ru"

    @field_validator("messages")
    @classmethod
    def messages_are_valid(cls, value: list[SummaryMessage]) -> list[SummaryMessage]:
        if not value:
            raise ValueError("messages must not be empty")
        if len(value) > MAX_SUMMARY_MESSAGES:
            raise ValueError(
                f"messages must contain at most {MAX_SUMMARY_MESSAGES} items"
            )
        return value

    @field_validator("language")
    @classmethod
    def language_is_supported(cls, value: str) -> str:
        return _clean_language(value)


class SummaryResponse(BaseModel):
    summary: str
    decisions: list[str]
    participants: list[str]
    language: str
    provider: str


class ConstructionTermsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    source_language: str
    response_language: str
    country_code: str
    max_terms: int = Field(default=5, ge=1, le=10)

    @field_validator("text")
    @classmethod
    def text_is_valid(cls, value: str) -> str:
        return _clean_text(value, "text")

    @field_validator("source_language", "response_language")
    @classmethod
    def languages_are_supported(cls, value: str, info) -> str:
        return _clean_language(value, info.field_name)

    @field_validator("country_code")
    @classmethod
    def country_code_is_iso_alpha2(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", normalized):
            raise PydanticCustomError(
                "invalid_country_code", "country_code must be a two-letter ISO code"
            )
        return normalized


class ConstructionTermResult(BaseModel):
    term: str
    start: int
    end: int
    definition: str
    country_code: str
    source_title: str
    source_url: str
    source_language: str


class ConstructionTermsResponse(BaseModel):
    terms: list[ConstructionTermResult]
    source_language: str
    response_language: str
    country_code: str
    provider: str
    mock: bool
    correlation_id: str


class STTResponse(BaseModel):
    transcript: str
    recognized_text: str
    summary: Optional[str] = None
    language: str
    provider: str


class SecretaryRequest(BaseModel):
    action: str
    details: str


class SecretaryResponse(BaseModel):
    message: str
    data: Optional[dict] = None


def get_llm_client():
    if mock_mode_enabled():
        return None
    provider = os.getenv("AI_PROVIDER", "").strip().lower()
    if provider == "lmstudio":
        try:
            return lm_studio_from_env()
        except LLMProviderError as exc:
            raise ServiceUnavailableError(str(exc)) from exc
    raise ServiceUnavailableError(
        "AI provider is unavailable; configure AI_PROVIDER or enable AI_MOCK_MODE"
    )


def get_stt_client():
    provider = os.getenv("STT_PROVIDER", "mock").strip().lower() or "mock"
    if provider == "mock":
        return None
    if provider in {"openai_compatible", "whisper"}:
        model = os.getenv("STT_MODEL", "whisper-1").strip()
        if not model:
            raise ServiceUnavailableError(
                "STT_MODEL is required when STT_PROVIDER=openai_compatible"
            )
        return OpenAICompatibleSTTClient(
            base_url=os.getenv("STT_BASE_URL", "http://127.0.0.1:9000/v1"),
            model=model,
            api_key=os.getenv("STT_API_KEY", ""),
            timeout=float(os.getenv("STT_TIMEOUT_SECONDS", "120")),
        )
    raise ServiceUnavailableError(f"Unsupported STT_PROVIDER: {provider}")


def _validation_payload(
    request: Request, exc: RequestValidationError
) -> dict[str, Any]:
    details = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"] if part != "body") or "body"
        message = error["msg"].removeprefix("Value error, ")
        details.append({"field": field, "message": message})
    return {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "details": details,
        },
        "correlation_id": get_correlation_id(request),
    }


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    payload = _validation_payload(request, exc)
    logger.warning(
        "request_validation_failed correlation_id=%s path=%s fields=%s",
        get_correlation_id(request),
        request.url.path,
        ",".join(detail["field"] for detail in payload["error"]["details"]),
    )
    return JSONResponse(status_code=422, content=payload)


@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_handler(
    request: Request, exc: ServiceUnavailableError
) -> JSONResponse:
    logger.error(
        "ai_provider_unavailable correlation_id=%s path=%s reason=%s",
        get_correlation_id(request),
        request.url.path,
        str(exc),
    )
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "ai_provider_unavailable",
                "message": "AI provider is unavailable",
                "details": [],
            },
            "correlation_id": get_correlation_id(request),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    codes = {
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "validation_error",
        503: "provider_unavailable",
        504: "provider_timeout",
        502: "ai_provider_error",
    }
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    logger.warning(
        "http_error correlation_id=%s path=%s status=%s",
        get_correlation_id(request),
        request.url.path,
        exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "detail": exc.detail,
            "error": {
                "code": codes.get(exc.status_code, "http_error"),
                "message": detail,
                "details": [],
            },
            "correlation_id": get_correlation_id(request),
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unexpected_error correlation_id=%s path=%s",
        get_correlation_id(request),
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Internal server error",
                "details": [],
            },
            "correlation_id": get_correlation_id(request),
        },
    )


@app.get("/")
def root():
    return {"message": "AI Service is running"}


_LANGUAGE_NAMES = {
    "ru": "Russian",
    "en": "English",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "zh": "Chinese",
    "ar": "Arabic",
}


def _parse_json_object(raw_output: str, purpose: str) -> dict[str, Any]:
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        payload = json.loads(cleaned)
    except (TypeError, json.JSONDecodeError) as exc:
        raise LLMProviderError(f"LM Studio returned invalid {purpose} JSON") from exc
    if not isinstance(payload, dict):
        raise LLMProviderError(f"LM Studio returned invalid {purpose} JSON")
    return payload


def _extract_construction_terms(raw_output: str, text: str, max_terms: int) -> list[tuple[str, re.Match[str]]]:
    payload = _parse_json_object(raw_output, "construction terms")
    values = payload.get("terms")
    if not isinstance(values, list):
        raise LLMProviderError("LM Studio returned invalid construction terms")

    matches: list[tuple[str, re.Match[str]]] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        term = value.strip()
        folded = term.casefold()
        if not term or len(term) > 100 or folded in seen:
            continue
        match = re.search(re.escape(term), text, flags=re.IGNORECASE)
        if match is None:
            continue
        seen.add(folded)
        matches.append((term, match))
        if len(matches) >= max_terms:
            break
    return matches


def _parse_construction_definitions(
    raw_output: str, sourced_terms: list[dict[str, str]]
) -> dict[str, str]:
    payload = _parse_json_object(raw_output, "construction term definitions")
    definitions = payload.get("definitions")
    if not isinstance(definitions, list):
        raise LLMProviderError("LM Studio returned invalid construction term definitions")

    allowed = {source["term"] for source in sourced_terms}
    result: dict[str, str] = {}
    for item in definitions:
        if not isinstance(item, dict):
            continue
        term = item.get("term")
        definition = item.get("definition")
        if (
            isinstance(term, str)
            and term in allowed
            and isinstance(definition, str)
            and definition.strip()
        ):
            result[term] = definition.strip()[:500]
    return result


def _utf16_offset(text: str, codepoint_offset: int) -> int:
    """Convert Python codepoint offsets to JavaScript UTF-16 string offsets."""

    return len(text[:codepoint_offset].encode("utf-16-le")) // 2


@app.post(
    "/construction-terms",
    response_model=ConstructionTermsResponse,
    responses={
        422: {"model": ErrorResponse, "description": "Request validation failed"},
        502: {"model": ErrorResponse, "description": "AI or reference provider error"},
        503: {"model": ErrorResponse, "description": "Provider unavailable"},
        504: {"model": ErrorResponse, "description": "Provider timeout"},
    },
)
async def construction_terms(req: ConstructionTermsRequest, request: Request):
    started = perf_counter()
    correlation_id = get_correlation_id(request)
    provider_name = ai_provider_name()
    if mock_mode_enabled():
        return ConstructionTermsResponse(
            terms=[],
            source_language=req.source_language,
            response_language=req.response_language,
            country_code=req.country_code,
            provider="mock",
            mock=True,
            correlation_id=correlation_id,
        )

    logger.info(
        "construction_terms_request provider=%s country=%s source_language=%s "
        "response_language=%s correlation_id=%s text_length=%s",
        provider_name,
        req.country_code,
        req.source_language,
        req.response_language,
        correlation_id,
        len(req.text),
    )
    try:
        llm_client = get_llm_client()
        if llm_client is None:
            raise ServiceUnavailableError("Construction term extraction requires a real AI provider")

        raw_terms = await llm_client.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Ты извлекаешь строительную терминологию из сообщений. "
                        "Верни только JSON {terms: string[]}. Включай только "
                        "специальные термины строительной отрасли, копируй каждый "
                        "точно из текста и не добавляй общеупотребительные слова."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Язык сообщения: {req.source_language}; страна отправителя: "
                        f"{req.country_code}; максимум терминов: {req.max_terms}.\n"
                        f"Сообщение:\n{req.text}"
                    ),
                },
            ],
            json_mode=True,
            temperature=0.1,
        )
        extracted = _extract_construction_terms(raw_terms, req.text, req.max_terms)
        if not extracted:
            return ConstructionTermsResponse(
                terms=[], source_language=req.source_language,
                response_language=req.response_language, country_code=req.country_code,
                provider=provider_name, mock=False, correlation_id=correlation_id,
            )

        try:
            sources = await asyncio.gather(*[
                search_wikipedia_term(term, req.source_language, req.country_code)
                for term, _match in extracted
            ])
        except ProviderUnavailableError as exc:
            raise HTTPException(
                status_code=503,
                detail="Construction reference search is unavailable",
            ) from exc
        sourced_terms: list[dict[str, str]] = []
        for (term, _match), source in zip(extracted, sources):
            if source:
                sourced_terms.append({"term": term, **source})
        if not sourced_terms:
            return ConstructionTermsResponse(
                terms=[], source_language=req.source_language,
                response_language=req.response_language, country_code=req.country_code,
                provider=provider_name, mock=False, correlation_id=correlation_id,
            )

        source_context = [
            {
                "term": source["term"],
                "source_title": source["title"],
                "source_language": source["language"],
                "source_excerpt": source["extract"],
            }
            for source in sourced_terms
        ]
        raw_definitions = await llm_client.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Ты объясняешь строительные термины. Используй только "
                        "приведённые выдержки источников: не добавляй факты, которых "
                        "в них нет. Кратко переведи объяснение на запрошенный язык. "
                        "Верни только JSON {definitions: [{term: string, definition: string}]}."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Язык ответа интерфейса: {_LANGUAGE_NAMES[req.response_language]}.\n"
                        f"Страна контекста отправителя: {req.country_code}.\n"
                        "Source excerpt data:\n"
                        + json.dumps(source_context, ensure_ascii=False)
                    ),
                },
            ],
            json_mode=True,
            temperature=0.1,
        )
        definitions = _parse_construction_definitions(raw_definitions, sourced_terms)
        source_by_term = {source["term"]: source for source in sourced_terms}
        results = []
        for term, match in extracted:
            source = source_by_term.get(term)
            definition = definitions.get(term)
            if source is None or definition is None:
                continue
            results.append(ConstructionTermResult(
                term=term,
                start=_utf16_offset(req.text, match.start()),
                end=_utf16_offset(req.text, match.end()),
                definition=definition,
                country_code=req.country_code,
                source_title=source["title"],
                source_url=source["url"],
                source_language=source["language"],
            ))
    except ServiceUnavailableError:
        raise
    except ProviderUnavailableError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except LLMProviderTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except LLMProviderError as exc:
        logger.exception(
            "construction_terms_provider_error correlation_id=%s", correlation_id
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    logger.info(
        "construction_terms_response provider=%s country=%s terms=%s "
        "correlation_id=%s duration_ms=%s",
        provider_name,
        req.country_code,
        len(results),
        correlation_id,
        int((perf_counter() - started) * 1000),
    )
    return ConstructionTermsResponse(
        terms=results,
        source_language=req.source_language,
        response_language=req.response_language,
        country_code=req.country_code,
        provider=provider_name,
        mock=False,
        correlation_id=correlation_id,
    )


def _mock_assist(text: str, action: str) -> str:
    if action == "shorten":
        return text if len(text) <= 160 else f"{text[:157].rstrip()}..."
    if action == "formal":
        return f"[formal] {text}"
    return f"[friendly] {text}"


@app.post(
    "/translate",
    response_model=TextOperationResponse,
    responses={
        422: {"model": ErrorResponse, "description": "Request validation failed"},
        502: {"model": ErrorResponse, "description": "AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unavailable"},
        504: {"model": ErrorResponse, "description": "AI provider timeout"},
    },
)
async def translate(req: TranslateRequest, request: Request):
    started = perf_counter()
    correlation_id = get_correlation_id(request)
    provider_name = ai_provider_name()
    logger.info(
        "ai_request endpoint=translate action=translate provider=%s "
        "correlation_id=%s text_length=%s",
        provider_name,
        correlation_id,
        len(req.text),
    )
    try:
        client = get_llm_client()
        if client is None:
            translated = f"[mock {req.source_lang}->{req.target_lang}] {req.text}"
            is_mock = True
        else:
            translated = await client.complete(
                [
                    {
                        "role": "system",
                        "content": "Ты переводчик. Верни только перевод без пояснений.",
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Переведи с {req.source_lang} на {req.target_lang}:\n{req.text}"
                        ),
                    },
                ]
            )
            is_mock = False
    except ServiceUnavailableError:
        raise
    except ProviderUnavailableError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except LLMProviderTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except LLMProviderError as exc:
        logger.exception(
            "ai_provider_error endpoint=translate correlation_id=%s", correlation_id
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    logger.info(
        "ai_response endpoint=translate action=translate provider=%s "
        "correlation_id=%s duration_ms=%s",
        provider_name,
        correlation_id,
        int((perf_counter() - started) * 1000),
    )
    return TextOperationResponse(
        input_text=req.text,
        result=translated,
        action="translate",
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        correlation_id=correlation_id,
        mock=is_mock,
    )


@app.post(
    "/assist",
    response_model=TextOperationResponse,
    responses={
        422: {"model": ErrorResponse, "description": "Request validation failed"},
        502: {"model": ErrorResponse, "description": "AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unavailable"},
        504: {"model": ErrorResponse, "description": "AI provider timeout"},
    },
)
async def assist(req: AssistRequest, request: Request):
    started = perf_counter()
    correlation_id = get_correlation_id(request)
    provider_name = ai_provider_name()
    logger.info(
        "ai_request endpoint=assist action=%s provider=%s "
        "correlation_id=%s text_length=%s",
        req.action,
        provider_name,
        correlation_id,
        len(req.text),
    )
    try:
        client = get_llm_client()
        if client is None:
            result = _mock_assist(req.text, req.action)
            is_mock = True
        else:
            context = f"\nКонтекст: {req.context}" if req.context else ""
            result = await client.complete(
                [
                    {
                        "role": "system",
                        "content": "Ты помощник редактора сообщений. Верни только готовый текст.",
                    },
                    {
                        "role": "user",
                        "content": f"Действие: {req.action}\nТекст: {req.text}{context}",
                    },
                ]
            )
            is_mock = False
    except ServiceUnavailableError:
        raise
    except ProviderUnavailableError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except LLMProviderTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except LLMProviderError as exc:
        logger.exception(
            "ai_provider_error endpoint=assist action=%s correlation_id=%s",
            req.action,
            correlation_id,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    logger.info(
        "ai_response endpoint=assist action=%s provider=%s "
        "correlation_id=%s duration_ms=%s",
        req.action,
        provider_name,
        correlation_id,
        int((perf_counter() - started) * 1000),
    )
    return TextOperationResponse(
        input_text=req.text,
        result=result,
        action=req.action,
        correlation_id=correlation_id,
        mock=is_mock,
    )


def _unique_strings(values: object, field: str) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list) or any(
        not isinstance(value, str) or not value.strip() for value in values
    ):
        raise LLMProviderError(
            f"LM Studio returned an invalid structured summary ({field})"
        )
    result: list[str] = []
    for value in values:
        value = value.strip()
        if value not in result:
            result.append(value)
    return result


def _parse_summary_output(
    raw_output: str,
    *,
    participants: list[str],
    language: str,
    provider: str,
) -> SummaryResponse:
    fence = chr(96) * 3
    cleaned = raw_output.strip()
    if cleaned.startswith(fence):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith(fence):
            lines = lines[1:]
        if lines and lines[-1].strip() == fence:
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        payload = json.loads(cleaned)
    except (TypeError, json.JSONDecodeError):
        relaxed = re.sub(
            r"([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:",
            lambda match: f'{match.group(1)}"{match.group(2)}":',
            cleaned,
        )
        try:
            payload = json.loads(relaxed)
        except (TypeError, json.JSONDecodeError) as exc:
            raise LLMProviderError(
                "LM Studio returned an invalid structured summary"
            ) from exc
    if not isinstance(payload, dict):
        raise LLMProviderError("LM Studio returned an invalid structured summary")
    summary = payload.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise LLMProviderError("LM Studio returned an invalid structured summary")
    return SummaryResponse(
        summary=summary.strip(),
        decisions=_unique_strings(payload.get("decisions", []), "decisions"),
        participants=_unique_strings(payload.get("participants"), "participants")
        or participants,
        language=language,
        provider=provider,
    )


def _mock_summary(req: SummaryRequest) -> SummaryResponse:
    summary = " ".join(message.text for message in req.messages)
    if len(summary) > 300:
        summary = f"{summary[:297].rstrip()}..."
    return SummaryResponse(
        summary=summary,
        decisions=[],
        participants=list(dict.fromkeys(message.sender_id for message in req.messages)),
        language=req.language,
        provider="mock",
    )


@app.post(
    "/summary",
    response_model=SummaryResponse,
    responses={
        502: {"description": "AI provider error"},
        503: {"model": ErrorResponse, "description": "AI provider unavailable"},
        504: {"model": ErrorResponse, "description": "AI provider timeout"},
    },
)
@app.post(
    "/summarize",
    response_model=SummaryResponse,
    responses={
        502: {"description": "AI provider error"},
        503: {"model": ErrorResponse, "description": "Speech provider unavailable"},
        504: {"description": "Speech provider timeout"},
    },
)
async def summarize(req: SummaryRequest):
    provider_name = ai_provider_name()
    logger.info(
        "ai_request endpoint=summary provider=%s messages=%s",
        provider_name,
        len(req.messages),
    )
    participants = list(dict.fromkeys(message.sender_id for message in req.messages))
    try:
        client = get_llm_client()
        if client is None:
            return _mock_summary(req)
        dialog = json.dumps(
            [message.model_dump(exclude_none=True) for message in req.messages],
            ensure_ascii=False,
        )
        raw_output = await client.complete(
            [
                {
                    "role": "system",
                    "content": (
                        "Ты редактор итогов командного чата. Верни только JSON без markdown "
                        "в формате {summary:string, decisions:string[], participants:string[]}."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Язык ответа: {req.language}\nДиалог:\n{dialog}",
                },
            ],
            json_mode=True,
            temperature=0.1,
        )
        return _parse_summary_output(
            raw_output,
            participants=participants,
            language=req.language,
            provider=provider_name,
        )
    except ServiceUnavailableError:
        raise
    except ProviderUnavailableError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except LLMProviderError as exc:
        logger.exception(
            "ai_provider_error endpoint=summary provider=%s", provider_name
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post(
    "/stt",
    response_model=STTResponse,
    responses={
        413: {"description": "Audio payload is too large"},
        415: {"description": "Unsupported audio media type"},
        502: {"description": "Speech provider error"},
    },
)
async def speech_to_text(audio: UploadFile = File(...), language: str = Form("ru")):
    try:
        language = _clean_language(language, "language")
    except (TypeError, ValueError, PydanticCustomError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    filename = audio.filename or "audio"
    content_type = (audio.content_type or "").lower()
    suffix = os.path.splitext(filename)[1].lower()
    if (
        content_type not in SUPPORTED_AUDIO_TYPES
        and suffix not in SUPPORTED_AUDIO_EXTENSIONS
    ):
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format; use wav, mp3, webm, ogg or m4a",
        )
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="audio must not be empty")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"audio is too large; maximum is {MAX_AUDIO_BYTES} bytes",
        )
    provider_name = os.getenv("STT_PROVIDER", "mock").strip().lower() or "mock"
    logger.info(
        "ai_request endpoint=stt provider=%s language=%s bytes=%s",
        provider_name,
        language,
        len(audio_bytes),
    )
    try:
        client = get_stt_client()
        if client is None:
            transcript = f"[распознано на {language}] Это пример голосового сообщения."
            provider_name = "mock"
        else:
            transcript = await client.transcribe(
                audio=audio_bytes,
                filename=filename,
                content_type=content_type or "application/octet-stream",
                language=language,
            )
    except ServiceUnavailableError:
        raise
    except ProviderUnavailableError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except SpeechProviderTimeout as exc:
        logger.exception(
            "speech_provider_timeout endpoint=stt provider=%s", provider_name
        )
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except LLMProviderError as exc:
        logger.exception("ai_provider_error endpoint=stt provider=%s", provider_name)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return STTResponse(
        transcript=transcript,
        recognized_text=transcript,
        language=language,
        provider=provider_name,
    )


@app.post("/secretary", response_model=SecretaryResponse)
async def secretary(req: SecretaryRequest):
    if req.action == "create_meeting":
        return SecretaryResponse(
            message="Встреча создана (заглушка)",
            data={"event_id": "123", "datetime": "2025-04-03T10:00:00"},
        )
    if req.action == "reminder":
        return SecretaryResponse(
            message="Напоминание установлено", data={"reminder_id": "456"}
        )
    if req.action == "summary":
        return SecretaryResponse(message=f"Итоги обсуждения: {req.details[:100]}")
    return SecretaryResponse(message="Неизвестное действие")


@app.post("/document-analysis")
async def document_analysis(
    file: UploadFile = File(...), extract_fields: Optional[str] = Form(None)
):
    return {
        "filename": file.filename,
        "summary": "Это тестовый анализ документа. Извлечены ключевые слова.",
        "fields": {"реквизиты": "123-456", "суть": "пример документа"},
        "classification": "договор",
    }


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
