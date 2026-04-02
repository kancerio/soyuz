import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_stt_mock():
    # Отправляем пустой файл, но заглушка всё равно вернёт фиктивный ответ
    files = {"audio": ("test.wav", b"fake audio data", "audio/wav")}
    data = {"language": "ru"}
    response = client.post("/stt", files=files, data=data)
    assert response.status_code == 200
    json_data = response.json()
    assert "recognized_text" in json_data
    assert "summary" in json_data