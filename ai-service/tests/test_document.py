import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_document_analysis():
    files = {"file": ("test.pdf", b"fake pdf content", "application/pdf")}
    data = {"extract_fields": "реквизиты,суть"}
    response = client.post("/document-analysis", files=files, data=data)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["filename"] == "test.pdf"
    assert "summary" in json_data
    assert "fields" in json_data