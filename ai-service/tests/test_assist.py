import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_assist_shorten():
    payload = {
        "prompt": "This is a very long text that needs to be shortened to a few words.",
        "action": "shorten"
    }
    response = client.post("/assist", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    assert "Кратко:" in data["result"]

def test_assist_change_tone():
    payload = {
        "prompt": "You are stupid.",
        "action": "change_tone"
    }
    response = client.post("/assist", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "(Сменили тон)" in data["result"]