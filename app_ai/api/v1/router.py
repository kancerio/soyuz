from fastapi import APIRouter
from app_ai.api.v1.endpoints import translation, speech, summarization, documents

router = APIRouter(prefix="/api/v1")
router.include_router(translation.router, prefix="/translate", tags=["Translation"])
router.include_router(speech.router, prefix="/speech", tags=["Speech"])
router.include_router(summarization.router, prefix="/summarize", tags=["Summarization"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])