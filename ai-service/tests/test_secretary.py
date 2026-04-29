import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_secretary_create_meeting():
    payload = {
        "action": "create_meeting",
        "details": "Meeting tomorrow at 10am"
    }
    response = client.post("/secretary", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Встреча создана (заглушка)"
    assert "event_id" in data["data"]

def test_secretary_reminder():
    payload = {
        "action": "reminder",
        "details": "Call boss"
    }
    response = client.post("/secretary", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Напоминание установлено"