import json
import logging
import os
from typing import Literal, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
import uvicorn

from .llm_provider import (
    LLMProviderError,
    OpenAICompatibleSTTClient,
    lm_studio_from_env,
)

app = FastAPI(title="AI Service for Messenger", version="0.1.0")
logger = logging.getLogger("ai-service")

MAX_TEXT_LENGTH = 5000
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(25 * 1024 * 1024)))
MAX_SUMMARY_MESSAGES = int(os.getenv("MAX_SUMMARY_MESSAGES", "100"))
SUPPORTED_LANGUAGES = {"ru", "en", "de", "fr", "es", "zh", "ar"}
ASSIST_ACTIONS = {"shorten", "formal", "friendly"}
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


def _clean_text(value: object, field: str) -> object:
    if not isinstance(value, str):
        return value
    value = value.strip()
    if not value:
        raise ValueError(f"{field} must not be empty")
    if len(value) > MAX_TEXT_LENGTH:
        raise ValueError(
            f"{field} is too long; maximum is {MAX_TEXT_LENGTH} characters"
        )
    return value


def _clean_language(value: object, field: str = "language") -> object:
    if not isinstance(value, str):
        return value
    value = value.strip().lower()
    if value not in SUPPORTED_LANGUAGES:
        allowed = ", ".join(sorted(SUPPORTED_LANGUAGES))
        raise ValueError(f"{field} must be one of: {allowed}")
    return value


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    fields = [
        {
            "field": ".".join(str(part) for part in error.get("loc", [])),
            "message": error.get("msg", "invalid value"),
        }
        for error in exc.errors()
    ]
    logger.warning("validation_error path=%s fields=%s", request.url.path, fields)
    return JSONResponse(
        status_code=422,
        content={
            "detail": fields,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Проверьте входные данные",
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_codes = {
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        422: "VALIDATION_ERROR",
        502: "AI_PROVIDER_ERROR",
    }
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    logger.warning(
        "http_error path=%s status=%s code=%s",
        request.url.path,
        exc.status_code,
        status_codes.get(exc.status_code, "HTTP_ERROR"),
    )
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "detail": exc.detail,
            "error": {
                "code": status_codes.get(exc.status_code, "HTTP_ERROR"),
                "message": detail,
            },
        },
    )


def get_llm_client():
    """Return the configured local provider, or ``None`` for mock mode."""

    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()
    if provider in {"", "mock"}:
        return None
    if provider == "lmstudio":
        return lm_studio_from_env()
    raise LLMProviderError(f"Unsupported AI_PROVIDER: {provider}")


def get_stt_client():
    """Return an OpenAI-compatible speech provider, or ``None`` for mock mode."""

    provider = os.getenv("STT_PROVIDER", "mock").strip().lower()
    if provider in {"", "mock"}:
        return None
    if provider in {"openai_compatible", "whisper"}:
        model = os.getenv("STT_MODEL", "whisper-1").strip()
        if not model:
            raise LLMProviderError(
                "STT_MODEL is required when STT_PROVIDER=openai_compatible"
            )
        return OpenAICompatibleSTTClient(
            base_url=os.getenv(
                "STT_BASE_URL", "http://127.0.0.1:9000/v1"
            ),
            model=model,
            api_key=os.getenv("STT_API_KEY", ""),
            timeout=float(os.getenv("STT_TIMEOUT_SECONDS", "120")),
        )
    raise LLMProviderError(f"Unsupported STT_PROVIDER: {provider}")


# ---------- Модели данных ----------
class TranslateRequest(BaseModel):
    text: str
    source_lang: str  # язык исходного текста
    target_lang: str  # язык перевода

    @field_validator("text", mode="before")
    @classmethod
    def validate_text(cls, value: object) -> object:
        return _clean_text(value, "text")

    @field_validator("source_lang", "target_lang", mode="before")
    @classmethod
    def validate_language(cls, value: object) -> object:
        return _clean_language(value, "language")


class AIResponse(BaseModel):
    """Common response shape for text AI endpoints."""

    result: str
    original_text: Optional[str] = None
    translated_text: Optional[str] = None
    source_lang: Optional[str] = None
    target_lang: Optional[str] = None
    action: Optional[str] = None


class AssistRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    action: Literal["shorten", "formal", "friendly"]

    @field_validator("prompt", mode="before")
    @classmethod
    def validate_prompt(cls, value: object) -> object:
        return _clean_text(value, "prompt")

    @field_validator("context", mode="before")
    @classmethod
    def validate_context(cls, value: object) -> object:
        if value is None:
            return value
        return _clean_text(value, "context")


class SummaryMessage(BaseModel):
    sender_id: str
    text: str
    timestamp: Optional[str] = None

    @field_validator("sender_id", "text", mode="before")
    @classmethod
    def validate_message_text(cls, value: object, info) -> object:
        return _clean_text(value, info.field_name)


class SummaryRequest(BaseModel):
    messages: list[SummaryMessage]
    language: str = "ru"

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, value: list[SummaryMessage]) -> list[SummaryMessage]:
        if not value:
            raise ValueError("messages must not be empty")
        if len(value) > MAX_SUMMARY_MESSAGES:
            raise ValueError(
                f"messages must contain at most {MAX_SUMMARY_MESSAGES} items"
            )
        return value

    @field_validator("language", mode="before")
    @classmethod
    def validate_summary_language(cls, value: object) -> object:
        return _clean_language(value)


class SummaryResponse(BaseModel):
    summary: str
    decisions: list[str]
    participants: list[str]
    language: str
    provider: str


class STTResponse(BaseModel):
    transcript: str
    # Keep the previous field while clients migrate to the stable transcript name.
    recognized_text: str
    summary: Optional[str] = None
    language: str
    provider: str


class SecretaryRequest(BaseModel):
    action: str  # "create_meeting", "reminder", "summary"
    details: str


class SecretaryResponse(BaseModel):
    message: str
    data: Optional[dict] = None


# ---------- Эндпоинты ----------
@app.get("/")
def root():
    return {"message": "AI Service is running"}


@app.post(
    "/translate",
    response_model=AIResponse,
    responses={502: {"description": "AI provider error"}},
)
async def translate(req: TranslateRequest):
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower() or "mock"
    logger.info("ai_request endpoint=translate provider=%s", provider)
    try:
        client = get_llm_client()
        if client is None:
            translated = f"[переведено с {req.source_lang} на {req.target_lang}]: {req.text}"
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
                            f"Переведи с {req.source_lang} на {req.target_lang}:\n"
                            f"{req.text}"
                        ),
                    },
                ]
            )
    except LLMProviderError as exc:
        logger.exception("ai_provider_error endpoint=translate")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return AIResponse(
        result=translated,
        original_text=req.text,
        translated_text=translated,
        source_lang=req.source_lang,
        target_lang=req.target_lang,
    )


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
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filename = audio.filename or "audio"
    content_type = (audio.content_type or "").lower()
    suffix = os.path.splitext(filename)[1].lower()
    if content_type not in SUPPORTED_AUDIO_TYPES and suffix not in SUPPORTED_AUDIO_EXTENSIONS:
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

    provider = os.getenv("STT_PROVIDER", "mock").strip().lower() or "mock"
    logger.info(
        "ai_request endpoint=stt provider=%s language=%s bytes=%s",
        provider,
        language,
        len(audio_bytes),
    )
    try:
        client = get_stt_client()
        if client is None:
            transcript = f"[распознано на {language}] Это пример голосового сообщения."
        else:
            transcript = await client.transcribe(
                audio=audio_bytes,
                filename=filename,
                content_type=content_type or "application/octet-stream",
                language=language,
            )
    except LLMProviderError as exc:
        logger.exception("ai_provider_error endpoint=stt provider=%s", provider)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return STTResponse(
        transcript=transcript,
        recognized_text=transcript,
        language=language,
        provider=provider,
    )


@app.post(
    "/assist",
    response_model=AIResponse,
    responses={502: {"description": "AI provider error"}},
)
async def assist(req: AssistRequest):
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower() or "mock"
    logger.info("ai_request endpoint=assist provider=%s action=%s", provider, req.action)
    try:
        client = get_llm_client()
        if client is None:
            # Заглушка: выполняем примитивное действие.
            if req.action == "shorten":
                result = f"Кратко: {req.prompt[:50]}..." if len(req.prompt) > 50 else req.prompt
            elif req.action == "formal":
                result = f"Формально: {req.prompt}"
            else:  # friendly
                result = f"Дружелюбно: {req.prompt}"
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
                        "content": f"Действие: {req.action}\nТекст: {req.prompt}{context}",
                    },
                ]
            )
    except LLMProviderError as exc:
        logger.exception("ai_provider_error endpoint=assist action=%s", req.action)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return AIResponse(result=result, original_text=req.prompt, action=req.action)


def _unique_strings(values: object, field: str) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list) or any(
        not isinstance(value, str) or not value.strip() for value in values
    ):
        raise LLMProviderError(f"LM Studio returned an invalid structured summary ({field})")
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
        raise LLMProviderError("LM Studio returned an invalid structured summary") from exc
    if not isinstance(payload, dict):
        raise LLMProviderError("LM Studio returned an invalid structured summary")

    summary = payload.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise LLMProviderError("LM Studio returned an invalid structured summary")
    decisions = _unique_strings(payload.get("decisions", []), "decisions")
    model_participants = _unique_strings(payload.get("participants"), "participants")
    return SummaryResponse(
        summary=summary.strip(),
        decisions=decisions,
        participants=model_participants or participants,
        language=language,
        provider=provider,
    )


def _mock_summary(req: SummaryRequest, provider: str) -> SummaryResponse:
    snippets = [message.text for message in req.messages]
    summary = " ".join(snippets)
    if len(summary) > 300:
        summary = f"{summary[:297].rstrip()}..."
    participants = list(dict.fromkeys(message.sender_id for message in req.messages))
    return SummaryResponse(
        summary=summary,
        decisions=[],
        participants=participants,
        language=req.language,
        provider=provider,
    )


@app.post(
    "/summary",
    response_model=SummaryResponse,
    responses={502: {"description": "AI provider error"}},
)
@app.post(
    "/summarize",
    response_model=SummaryResponse,
    responses={502: {"description": "AI provider error"}},
)
async def summarize(req: SummaryRequest):
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower() or "mock"
    logger.info(
        "ai_request endpoint=summary provider=%s messages=%s",
        provider,
        len(req.messages),
    )
    participants = list(dict.fromkeys(message.sender_id for message in req.messages))
    try:
        client = get_llm_client()
        if client is None:
            return _mock_summary(req, provider)

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
            provider=provider,
        )
    except LLMProviderError as exc:
        logger.exception("ai_provider_error endpoint=summary provider=%s", provider)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/secretary", response_model=SecretaryResponse)
async def secretary(req: SecretaryRequest):
    # Заглушка
    if req.action == "create_meeting":
        return SecretaryResponse(
            message="Встреча создана (заглушка)",
            data={"event_id": "123", "datetime": "2025-04-03T10:00:00"},
        )
    elif req.action == "reminder":
        return SecretaryResponse(
            message="Напоминание установлено", data={"reminder_id": "456"}
        )
    elif req.action == "summary":
        return SecretaryResponse(message=f"Итоги обсуждения: {req.details[:100]}")
    else:
        return SecretaryResponse(message="Неизвестное действие")


@app.post("/document-analysis")
async def document_analysis(
    file: UploadFile = File(...), extract_fields: Optional[str] = Form(None)
):
    # Заглушка: имитируем извлечение данных
    return {
        "filename": file.filename,
        "summary": "Это тестовый анализ документа. Извлечены ключевые слова.",
        "fields": {"реквизиты": "123-456", "суть": "пример документа"},
        "classification": "договор",
    }


# ---------- Запуск (для отладки) ----------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
