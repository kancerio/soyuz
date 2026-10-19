from pydantic import BaseModel
from typing import Optional

class TranslateResponse(BaseModel):
    translated_text: str
    source_lang_detected: Optional[str] = None
    correlation_id: str