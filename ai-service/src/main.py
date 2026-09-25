import logging
import os
import re
from time import perf_counter
from typing import Any, Literal, Optional
from uuid import uuid4

import uvicorn
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from pydantic_core import PydanticCustomError

MAX_TEXT_LENGTH = 5_000
MAX_CONTEXT_LENGTH = 10_000
SUPPORTED_LANGUAGES = frozenset({"ru", "en", "de", "fr", "es", "zh", "ar"})
CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

logging.basicConfig(
    level=getattr(logging, os.getenv("AI_LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("soyuz.ai")

app = FastAPI(title="AI Service for Messenger", version="0.2.0")


def validate_text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise PydanticCustomError("empty_text", "Text must not be empty")
    if len(normalized) > MAX_TEXT_LENGTH:
        raise PydanticCustomError(
            "text_too_long",
            f"Text must be at most {MAX_TEXT_LENGTH} characters",
        )
    return normalized


def normalize_language(value: str, *, allow_auto: bool) -> str:
    normalized = value.strip().lower()
    allowed = SUPPORTED_LANGUAGES | ({"auto"} if allow_auto else set())
    if normalized not in allowed:
        supported = ", ".join(sorted(allowed))
        raise PydanticCustomError(
            "unsupported_language",
            f"Unsupported language '{normalized}'. Supported values: {supported}",
        )
    return normalized


def mock_mode_enabled() -> bool:
    return os.getenv("AI_MOCK_MODE", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


class TranslateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    source_lang: str = "auto"
    target_lang: str

    @field_validator("text")
    @classmethod
    def text_is_valid(cls, value: str) -> str:
        return validate_text(value)

    @field_validator("source_lang")
    @classmethod
    def source_language_is_supported(cls, value: str) -> str:
        return normalize_language(value, allow_auto=True)

    @field_validator("target_lang")
    @classmethod
    def target_language_is_supported(cls, value: str) -> str:
        return normalize_language(value, allow_auto=False)


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
            value.pop("prompt")
        return value

    @field_validator("text")
    @classmethod
    def text_is_valid(cls, value: str) -> str:
        return validate_text(value)

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
    """Stable response contract shared by /translate and /assist."""

    input_text: str
    result: str
    action: Literal["translate", "shorten", "formal", "friendly"]
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    correlation_id: str
    mock: bool


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorContent(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail]


class ErrorResponse(BaseModel):
    error: ErrorContent
    correlation_id: str


TEXT_ENDPOINT_ERRORS = {
    422: {"model": ErrorResponse, "description": "Request validation failed"},
    500: {"model": ErrorResponse, "description": "Unexpected server error"},
    503: {"model": ErrorResponse, "description": "AI provider is unavailable"},
}


class SecretaryRequest(BaseModel):
    action: str
    details: str


class SecretaryResponse(BaseModel):
    message: str
    data: Optional[dict] = None


class ServiceUnavailableError(Exception):
    pass


def get_correlation_id(request: Request) -> str:
    return getattr(request.state, "correlation_id", str(uuid4()))


def validation_error_payload(
    request: Request, exc: RequestValidationError
) -> dict[str, Any]:
    details = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"] if part != "body")
        message = error["msg"].removeprefix("Value error, ")
        details.append({"field": field or "body", "message": message})
    return {
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "details": details,
        },
        "correlation_id": get_correlation_id(request),
    }


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    supplied = request.headers.get("X-Correlation-ID", "")
    request.state.correlation_id = (
        supplied if CORRELATION_ID_PATTERN.fullmatch(supplied) else str(uuid4())
    )
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = request.state.correlation_id
    return response


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    fields = [
        ".".join(str(part) for part in error["loc"] if part != "body") or "body"
        for error in exc.errors()
    ]
    logger.warning(
        "request_validation_failed correlation_id=%s path=%s fields=%s",
        get_correlation_id(request),
        request.url.path,
        ",".join(fields),
    )
    return JSONResponse(
        status_code=422,
        content=validation_error_payload(request, exc),
    )


@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_handler(
    request: Request, _exc: ServiceUnavailableError
) -> JSONResponse:
    correlation_id = get_correlation_id(request)
    logger.error(
        "ai_provider_unavailable correlation_id=%s path=%s",
        correlation_id,
        request.url.path,
    )
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "ai_provider_unavailable",
                "message": (
                    "AI mock mode is disabled, but no production AI provider "
                    "is configured"
                ),
                "details": [],
            },
            "correlation_id": correlation_id,
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    correlation_id = get_correlation_id(request)
    logger.error(
        "unexpected_error correlation_id=%s path=%s error_type=%s",
        correlation_id,
        request.url.path,
        type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected server error occurred",
                "details": [],
            },
            "correlation_id": correlation_id,
        },
    )


def require_mock_mode() -> None:
    if not mock_mode_enabled():
        raise ServiceUnavailableError


def mock_assist(text: str, action: str) -> str:
    if action == "shorten":
        return f"{text[:157].rstrip()}..." if len(text) > 160 else text
    if action == "formal":
        return f"[formal] {text}"
    return f"[friendly] {text}"


@app.get("/")
def root():
    return {"message": "AI Service is running"}


@app.post(
    "/translate",
    response_model=TextOperationResponse,
    responses=TEXT_ENDPOINT_ERRORS,
)
async def translate(req: TranslateRequest, request: Request):
    require_mock_mode()
    started_at = perf_counter()
    correlation_id = get_correlation_id(request)
    result = f"[mock {req.source_lang}->{req.target_lang}] {req.text}"
    logger.info(
        "text_operation_succeeded correlation_id=%s action=translate "
        "source_lang=%s target_lang=%s text_length=%d duration_ms=%d mock=true",
        correlation_id,
        req.source_lang,
        req.target_lang,
        len(req.text),
        int((perf_counter() - started_at) * 1000),
    )
    return TextOperationResponse(
        input_text=req.text,
        result=result,
        action="translate",
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        correlation_id=correlation_id,
        mock=True,
    )


@app.post(
    "/assist",
    response_model=TextOperationResponse,
    responses=TEXT_ENDPOINT_ERRORS,
)
async def assist(req: AssistRequest, request: Request):
    require_mock_mode()
    started_at = perf_counter()
    correlation_id = get_correlation_id(request)
    result = mock_assist(req.text, req.action)
    logger.info(
        "text_operation_succeeded correlation_id=%s action=%s "
        "text_length=%d context_length=%d duration_ms=%d mock=true",
        correlation_id,
        req.action,
        len(req.text),
        len(req.context or ""),
        int((perf_counter() - started_at) * 1000),
    )
    return TextOperationResponse(
        input_text=req.text,
        result=result,
        action=req.action,
        correlation_id=correlation_id,
        mock=True,
    )


@app.post("/stt")
async def speech_to_text(audio: UploadFile = File(...), language: str = Form("ru")):
    return {
        "recognized_text": f"[распознано на {language}] Это пример голосового сообщения.",
        "summary": "Краткое содержание: пример.",
        "language": language,
    }


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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
