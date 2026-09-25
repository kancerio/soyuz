from fastapi import FastAPI
from app.api.v1.router import router as v1_router

app = FastAPI(title="AI Messenger Service")
app.include_router(v1_router)

@app.get("/")
def root():
    return {"message": "AI Service running"}