import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_translate():
    payload = {
        "text": "Hello world",
        "source_lang": "en",
        "target_lang": "ru"
    }
    response = client.post("/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "translated_text" in data
    assert data["original_text"] == "Hello world"
    assert data["source_lang"] == "en"
    assert data["target_lang"] == "ru"