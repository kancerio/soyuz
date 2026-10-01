import json
from pathlib import Path

import pytest

from src.dataset_pipeline import (
    build_generation_prompt,
    load_jsonl,
    normalize_generated_examples,
    validate_records,
)


DATASET_PATH = Path(__file__).parents[1] / "dataset" / "seed.jsonl"


def test_seed_dataset_matches_training_schema():
    records = load_jsonl(DATASET_PATH)

    assert len(records) >= 12
    assert validate_records(records) == []


def test_validator_rejects_duplicate_ids_and_unknown_assist_action():
    record = {
        "id": "duplicate",
        "task": "assist",
        "split": "train",
        "input": {"prompt": "Сделай текст вежливее", "action": "change_tone"},
        "output": {"result": "Пожалуйста, уточни детали."},
        "metadata": {
            "source": "seed",
            "synthetic": False,
            "review_status": "unreviewed",
        },
    }

    errors = validate_records([record, dict(record)])

    assert any("duplicate id" in error for error in errors)
    assert any("assist action" in error for error in errors)


def test_validator_requires_translation_fields():
    record = {
        "id": "translation-missing-fields",
        "task": "translate",
        "split": "train",
        "input": {"text": "Hello"},
        "output": {"translated_text": "Привет"},
        "metadata": {
            "source": "seed",
            "synthetic": False,
            "review_status": "unreviewed",
        },
    }

    errors = validate_records([record])

    assert any("source_lang" in error for error in errors)
    assert any("target_lang" in error for error in errors)


def test_generation_prompt_requires_jsonl_and_quality_metadata():
    prompt = build_generation_prompt(
        task="translate",
        languages=["ru", "en"],
        count=3,
    )

    assert "JSONL" in prompt
    assert '"source_lang"' in prompt
    assert '"target_lang"' in prompt
    assert "Не добавляй персональные данные" in prompt


def test_generated_examples_get_local_provenance_and_validate():
    raw_response = {
        "examples": [
            {
                "input": {
                    "text": "Good morning",
                    "source_lang": "en",
                    "target_lang": "ru",
                },
                "output": {"translated_text": "Доброе утро"},
            }
        ]
    }

    records = normalize_generated_examples(
        raw_response,
        task="translate",
        split="train",
        model="test-model",
        batch_id="batch-a",
    )

    assert records[0]["id"] == "translate-batch-a-0001"
    assert records[0]["metadata"] == {
        "source": "deepseek_api",
        "synthetic": True,
        "review_status": "unreviewed",
        "model": "test-model",
        "terms_reference": "https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html",
    }
    assert validate_records(records) == []
