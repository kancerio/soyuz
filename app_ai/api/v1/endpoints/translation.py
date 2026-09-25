from fastapi import APIRouter, HTTPException
from app_ai.schemas.request import TranslateRequest
from app_ai.schemas.response import TranslateResponse
from app_ai.services.translation_service import translate_text
from app_ai.core.logging import get_logger
import uuid
import time

router = APIRouter()
logger = get_logger(__name__)

# Поддерживаемые языки (ISO 639-1)
SUPPORTED_LANGUAGES = {"ru", "en", "de", "fr", "es", "zh", "ar"}

@router.post("/", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    start_time = time.time()
    
    # 1. Проверка на пустой текст
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # 2. Проверка целевого языка
    if req.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {req.target_lang}. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )
    
    # 3. Генерация correlation_id, если не передан
    correlation_id = req.correlation_id or str(uuid.uuid4())
    
    # 4. Вызов сервиса перевода (пока mock)
    try:
        translated = translate_text(req.text, req.target_lang, source_lang=req.source_lang)
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Логирование (подробнее в шаге 2)
        logger.info(
            f"Translation success | correlation_id={correlation_id} | "
            f"source={req.source_lang or 'auto'} | target={req.target_lang} | "
            f"duration_ms={duration_ms}"
        )
        
        return TranslateResponse(
            translated_text=translated,
            source_lang_detected=req.source_lang or "en",  # заглушка
            correlation_id=correlation_id
        )
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(
            f"Translation failed | correlation_id={correlation_id} | "
            f"target={req.target_lang} | duration_ms={duration_ms} | error={str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")