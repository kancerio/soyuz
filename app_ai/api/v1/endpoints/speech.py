from fastapi import APIRouter
router = APIRouter()
@router.post("/transcribe")
async def transcribe():
    return {"transcript": "mock"}