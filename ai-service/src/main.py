from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
import logging
import os
import uvicorn

from .llm_provider import LLMProviderError, lm_studio_from_env

app = FastAPI(title="AI Service for Messenger", version="0.1.0")
logger = logging.getLogger("ai-service")

MAX_TEXT_LENGTH = 5000
SUPPORTED_LANGUAGES = {"ru", "en", "de", "fr", "es", "zh", "ar"}
ASSIST_ACTIONS = {"shorten", "formal", "friendly"}


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


def get_llm_client():
    """Return the configured local provider, or ``None`` for mock mode."""

    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()
    if provider in {"", "mock"}:
        return None
    if provider == "lmstudio":
        return lm_studio_from_env()
    raise LLMProviderError(f"Unsupported AI_PROVIDER: {provider}")


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
        if not isinstance(value, str):
            return value
        value = value.strip().lower()
        if value not in SUPPORTED_LANGUAGES:
            allowed = ", ".join(sorted(SUPPORTED_LANGUAGES))
            raise ValueError(f"language must be one of: {allowed}")
        return value


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


@app.post("/translate", response_model=AIResponse)
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


@app.post("/stt")
async def speech_to_text(audio: UploadFile = File(...), language: str = Form("ru")):
    # Заглушка: возвращаем фиктивный текст
    return {
        "recognized_text": f"[распознано на {language}] Это пример голосового сообщения.",
        "summary": "Краткое содержание: пример.",
        "language": language,
    }


@app.post("/assist", response_model=AIResponse)
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
