import json

import pytest

from src.sft_dataset import to_sft_record


def test_translate_record_becomes_chat_messages():
    record = {
        "id": "translate-1",
        "task": "translate",
        "split": "train",
        "input": {"text": "Hello", "source_lang": "en", "target_lang": "ru"},
        "output": {"translated_text": "Привет"},
        "metadata": {"review_status": "machine_checked"},
    }

    result = to_sft_record(record)

    assert [message["role"] for message in result["messages"]] == [
        "system",
        "user",
        "assistant",
    ]
    assert "en" in result["messages"][1]["content"]
    assert result["messages"][2]["content"] == "Привет"
    assert result["metadata"]["source_id"] == "translate-1"


def test_structured_output_is_serialized_as_json():
    record = {
        "id": "summary-1",
        "task": "summary",
        "split": "validation",
        "input": {"messages": [{"sender_id": "u1", "text": "Релиз завтра"}]},
        "output": {"summary": "Релиз завтра", "decisions": ["релиз завтра"]},
        "metadata": {"review_status": "machine_checked"},
    }

    result = to_sft_record(record)
    output = json.loads(result["messages"][2]["content"])

    assert output["summary"] == "Релиз завтра"
    assert result["task"] == "summary"


def test_unknown_task_is_rejected():
    with pytest.raises(ValueError, match="unsupported task"):
        to_sft_record({"id": "bad", "task": "unknown", "input": {}, "output": {}})
