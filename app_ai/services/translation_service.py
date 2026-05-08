from app.models.translation import get_translation_model
from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)

def translate_text(text: str, target_lang: str) -> str:
    if settings.AI_MOCK_MODE:
        logger.info(f"MOCK: translate '{text}' to {target_lang}")
        return f"[mock_{target_lang}] {text}"
    
    try:
        # Упрощённо: считаем, что исходный язык английский
        model, tokenizer = get_translation_model()
        inputs = tokenizer(text, return_tensors="pt", padding=True)
        translated = model.generate(**inputs)
        result = tokenizer.decode(translated[0], skip_special_tokens=True)
        logger.info(f"Translated: {result}")
        return result
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return f"[error] {text}"