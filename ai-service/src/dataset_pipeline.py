"""Validation and generation helpers for the AI training dataset.

The module is deliberately dependency-free so that dataset checks can run in
CI and before a model or a provider is selected.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable


SUPPORTED_LANGUAGES = {"ru", "en", "de", "fr", "es", "zh", "ar"}
SUPPORTED_TASKS = {"translate", "assist", "summary", "document_analysis", "stt"}
SUPPORTED_SPLITS = {"train", "validation", "test"}
SUPPORTED_SOURCES = {"seed", "deepseek_api", "deepseek_local", "human", "public_dataset"}
SUPPORTED_REVIEW_STATUSES = {"unreviewed", "machine_checked", "human_reviewed", "rejected"}
ASSIST_ACTIONS = {"shorten", "formal", "friendly"}
DEEPSEEK_TERMS_URL = "https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html"
DEEPSEEK_R1_LICENSE_URL = "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/LICENSE"


def load_jsonl(path: str | Path) -> list[dict[str, Any]]:
    """Load non-empty JSONL rows and report the line that cannot be parsed."""

    records: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not raw_line.strip():
            continue
        try:
            value = json.loads(raw_line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSON on line {line_number}: {exc.msg}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"line {line_number} must contain a JSON object")
        records.append(value)
    return records


def _require_string(value: Any, field: str, errors: list[str], record_id: str) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{record_id}: {field} must be a non-empty string")


def _validate_task_payload(record: dict[str, Any], errors: list[str], record_id: str) -> None:
    task = record.get("task")
    payload = record.get("input")
    output = record.get("output")
    if not isinstance(payload, dict) or not isinstance(output, dict):
        return

    if task == "translate":
        for field in ("text", "source_lang", "target_lang"):
            _require_string(payload.get(field), field, errors, record_id)
        _require_string(output.get("translated_text"), "translated_text", errors, record_id)
    elif task == "assist":
        _require_string(payload.get("prompt"), "prompt", errors, record_id)
        action = payload.get("action")
        if action not in ASSIST_ACTIONS:
            errors.append(
                f"{record_id}: assist action must be one of {sorted(ASSIST_ACTIONS)}"
            )
        _require_string(output.get("result"), "result", errors, record_id)
    elif task == "summary":
        messages = payload.get("messages")
        if not isinstance(messages, list) or not messages:
            errors.append(f"{record_id}: messages must be a non-empty list")
        else:
            for index, message in enumerate(messages):
                if not isinstance(message, dict):
                    errors.append(f"{record_id}: messages[{index}] must be an object")
                    continue
                _require_string(message.get("sender_id"), f"messages[{index}].sender_id", errors, record_id)
                _require_string(message.get("text"), f"messages[{index}].text", errors, record_id)
        _require_string(output.get("summary"), "summary", errors, record_id)
    elif task == "document_analysis":
        _require_string(payload.get("document_text"), "document_text", errors, record_id)
        _require_string(output.get("summary"), "summary", errors, record_id)
    elif task == "stt":
        _require_string(payload.get("audio_ref"), "audio_ref", errors, record_id)
        _require_string(payload.get("language"), "language", errors, record_id)
        _require_string(output.get("transcript"), "transcript", errors, record_id)


def validate_records(records: Iterable[dict[str, Any]]) -> list[str]:
    """Return human-readable schema errors without mutating the input."""

    errors: list[str] = []
    seen_ids: set[str] = set()

    for position, record in enumerate(records, 1):
        if not isinstance(record, dict):
            errors.append(f"row {position}: record must be an object")
            continue

        record_id = record.get("id")
        if not isinstance(record_id, str) or not record_id.strip():
            record_id = f"row {position}"
            errors.append(f"{record_id}: id must be a non-empty string")
        elif record_id in seen_ids:
            errors.append(f"duplicate id: {record_id}")
        else:
            seen_ids.add(record_id)

        task = record.get("task")
        if task not in SUPPORTED_TASKS:
            errors.append(f"{record_id}: task must be one of {sorted(SUPPORTED_TASKS)}")

        if record.get("split") not in SUPPORTED_SPLITS:
            errors.append(f"{record_id}: split must be one of {sorted(SUPPORTED_SPLITS)}")

        if not isinstance(record.get("input"), dict):
            errors.append(f"{record_id}: input must be an object")
        if not isinstance(record.get("output"), dict):
            errors.append(f"{record_id}: output must be an object")

        metadata = record.get("metadata")
        if not isinstance(metadata, dict):
            errors.append(f"{record_id}: metadata must be an object")
        else:
            if metadata.get("source") not in SUPPORTED_SOURCES:
                errors.append(f"{record_id}: metadata.source is unsupported")
            if not isinstance(metadata.get("synthetic"), bool):
                errors.append(f"{record_id}: metadata.synthetic must be boolean")
            if metadata.get("review_status") not in SUPPORTED_REVIEW_STATUSES:
                errors.append(f"{record_id}: metadata.review_status is unsupported")
            source = metadata.get("source")
            if source == "deepseek_api":
                _require_string(metadata.get("model"), "metadata.model", errors, str(record_id))
                _require_string(
                    metadata.get("terms_reference"),
                    "metadata.terms_reference",
                    errors,
                    str(record_id),
                )
            if source == "deepseek_local":
                _require_string(metadata.get("model"), "metadata.model", errors, str(record_id))
                _require_string(
                    metadata.get("license_reference"),
                    "metadata.license_reference",
                    errors,
                    str(record_id),
                )
            if source == "public_dataset":
                _require_string(metadata.get("source_ref"), "metadata.source_ref", errors, str(record_id))
                _require_string(metadata.get("license"), "metadata.license", errors, str(record_id))
            if source == "human":
                _require_string(
                    metadata.get("permission_ref"),
                    "metadata.permission_ref",
                    errors,
                    str(record_id),
                )

        _validate_task_payload(record, errors, str(record_id))

    return errors


def build_generation_prompt(task: str, languages: list[str], count: int) -> str:
    """Build a constrained prompt for DeepSeek synthetic examples.

    The model is asked for data only; provenance and review metadata are added
    by the local generator rather than trusted from model output.
    """

    if task not in SUPPORTED_TASKS:
        raise ValueError(f"unsupported task: {task}")
    if count < 1:
        raise ValueError("count must be positive")
    language_text = ", ".join(languages)
    return f"""Сгенерируй {count} качественных примеров для задачи {task}.
Поддерживаемые языки: {language_text}.
Верни один JSON-объект вида {{"examples": [{{"input": {{...}}, "output": {{...}}}}]}}.
Локальный генератор преобразует массив examples в JSONL; не добавляй markdown и комментарии.
Не добавляй персональные данные, секреты, реальные токены или идентификаторы пользователей.
Каждый объект должен содержать input и output и соответствовать контракту задачи.
Для translate input обязан содержать "text", "source_lang" и "target_lang", а output — "translated_text".
Для assist поле "action" может быть только shorten, formal или friendly, а output должен содержать "result".
Для summary input должен содержать непустой массив messages с sender_id, text и timestamp, а output — summary.
Для document_analysis input должен содержать document_text, а output — summary и classification.
Сохраняй смысл входа, не выдумывай факты и не смешивай языки без причины.
"""


def normalize_generated_examples(
    raw_response: dict[str, Any] | list[Any],
    *,
    task: str,
    split: str,
    model: str,
    batch_id: str = "batch",
    source: str = "deepseek_api",
    provenance_reference: str | None = None,
) -> list[dict[str, Any]]:
    """Attach trusted local provenance to model-produced examples.

    IDs and metadata are generated locally. Model-provided IDs or metadata are
    intentionally ignored so that provenance cannot be spoofed by the model.
    """

    if task not in SUPPORTED_TASKS:
        raise ValueError(f"unsupported task: {task}")
    if split not in SUPPORTED_SPLITS:
        raise ValueError(f"unsupported split: {split}")
    if not model.strip():
        raise ValueError("model must be non-empty")
    if source not in {"deepseek_api", "deepseek_local"}:
        raise ValueError("source must be deepseek_api or deepseek_local")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", batch_id):
        raise ValueError("batch_id must contain only letters, digits, '-' or '_'")

    examples: Any = raw_response.get("examples") if isinstance(raw_response, dict) else raw_response
    if not isinstance(examples, list) or not examples:
        raise ValueError("model response must contain a non-empty examples array")

    if source == "deepseek_api":
        provenance = {"terms_reference": provenance_reference or DEEPSEEK_TERMS_URL}
    else:
        provenance = {"license_reference": provenance_reference or DEEPSEEK_R1_LICENSE_URL}

    records: list[dict[str, Any]] = []
    for index, example in enumerate(examples, 1):
        if not isinstance(example, dict):
            raise ValueError(f"example {index} must be an object")
        if not isinstance(example.get("input"), dict) or not isinstance(example.get("output"), dict):
            raise ValueError(f"example {index} must contain input and output objects")
        records.append(
            {
                "id": f"{task}-{batch_id}-{index:04d}",
                "task": task,
                "split": split,
                "input": example["input"],
                "output": example["output"],
                "metadata": {
                    "source": source,
                    "synthetic": True,
                    "review_status": "unreviewed",
                    "model": model,
                    **provenance,
                },
            }
        )
    return records
