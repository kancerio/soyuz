from fastapi import APIRouter, HTTPException
from app.schemas.request import TranslateRequest
from app.schemas.response import TranslateResponse
from app.services.translation_service import translate_text
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)

@router.post("/", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    supported = ["ru", "en", "de", "fr", "es", "zh", "ar"]
    if req.target_lang not in supported:
        logger.warning(f"Unsupported language: {req.target_lang}, fallback to en")
        target = "en"
    else:
        target = req.target_lang
    
    translated = translate_text(req.text, target)
    return TranslateResponse(translated_text=translated, source_lang_detected="en")