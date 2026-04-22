from fastapi import APIRouter
from app.schemas.request import TranslateRequest
from app.schemas.response import TranslateResponse

router = APIRouter()

@router.post("/", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    return TranslateResponse(translated_text=f"Mock: {req.text}", source_lang_detected="en")