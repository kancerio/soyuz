from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="AI Service for Messenger", version="0.1.0")

# ---------- Модели данных ----------
class TranslateRequest(BaseModel):
    text: str
    source_lang: str   # язык исходного текста
    target_lang: str   # язык перевода

class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str

class AssistRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    action: str  # "shorten", "change_tone", "suggest"

class AssistResponse(BaseModel):
    result: str

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

@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    # Заглушка: просто добавляем пометку "[переведено]"
    translated = f"[переведено с {req.source_lang} на {req.target_lang}]: {req.text}"
    return TranslateResponse(
        original_text=req.text,
        translated_text=translated,
        source_lang=req.source_lang,
        target_lang=req.target_lang
    )

@app.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("ru")
):
    # Заглушка: возвращаем фиктивный текст
    return {
        "recognized_text": f"[распознано на {language}] Это пример голосового сообщения.",
        "summary": "Краткое содержание: пример.",
        "language": language
    }

@app.post("/assist", response_model=AssistResponse)
async def assist(req: AssistRequest):
    # Заглушка: выполняем примитивное действие
    if req.action == "shorten":
        result = f"Кратко: {req.prompt[:50]}..." if len(req.prompt) > 50 else req.prompt
    elif req.action == "change_tone":
        result = f"(Сменили тон) {req.prompt}"
    elif req.action == "suggest":
        result = f"Подсказка на основе: {req.prompt} -> попробуйте добавить детали."
    else:
        result = "Неизвестное действие"
    return AssistResponse(result=result)

@app.post("/secretary", response_model=SecretaryResponse)
async def secretary(req: SecretaryRequest):
    # Заглушка
    if req.action == "create_meeting":
        return SecretaryResponse(
            message="Встреча создана (заглушка)",
            data={"event_id": "123", "datetime": "2025-04-03T10:00:00"}
        )
    elif req.action == "reminder":
        return SecretaryResponse(message="Напоминание установлено", data={"reminder_id": "456"})
    elif req.action == "summary":
        return SecretaryResponse(message=f"Итоги обсуждения: {req.details[:100]}")
    else:
        return SecretaryResponse(message="Неизвестное действие")

@app.post("/document-analysis")
async def document_analysis(
    file: UploadFile = File(...),
    extract_fields: Optional[str] = Form(None)
):
    # Заглушка: имитируем извлечение данных
    return {
        "filename": file.filename,
        "summary": "Это тестовый анализ документа. Извлечены ключевые слова.",
        "fields": {"реквизиты": "123-456", "суть": "пример документа"},
        "classification": "договор"
    }

# ---------- Запуск (для отладки) ----------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)