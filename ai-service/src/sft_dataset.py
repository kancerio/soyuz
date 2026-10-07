"""Convert the reviewed task dataset into chat-style SFT examples."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any


_TASKS = {"translate", "assist", "summary", "document_analysis"}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def to_sft_record(record: Mapping[str, Any]) -> dict[str, Any]:
    task = record.get("task")
    if task not in _TASKS:
        raise ValueError(f"unsupported task: {task}")

    input_data = record.get("input") or {}
    output_data = record.get("output") or {}
    if not isinstance(input_data, Mapping) or not isinstance(output_data, Mapping):
        raise ValueError("input and output must be objects")

    if task == "translate":
        user_content = (
            f"Переведи с {input_data.get('source_lang')} на "
            f"{input_data.get('target_lang')}:\n{input_data.get('text', '')}"
        )
        assistant_content = str(output_data.get("translated_text", ""))
        system_content = "Ты профессиональный переводчик. Верни только перевод без пояснений."
    elif task == "assist":
        context = input_data.get("context")
        context_text = f"\nКонтекст: {context}" if context else ""
        user_content = (
            f"Действие: {input_data.get('action')}\n"
            f"Текст: {input_data.get('prompt', '')}{context_text}"
        )
        assistant_content = str(output_data.get("result", ""))
        system_content = "Ты помощник редактора сообщений. Верни только готовый текст."
    elif task == "summary":
        user_content = "Суммируй диалог и верни структурированный JSON:\n" + _json(
            input_data.get("messages", [])
        )
        assistant_content = _json(output_data)
        system_content = "Ты редактор кратких итогов командного чата."
    else:
        user_content = (
            "Проанализируй документ и верни структурированный JSON.\n"
            f"Имя файла: {input_data.get('filename', '')}\n"
            f"Текст:\n{input_data.get('document_text', '')}"
        )
        assistant_content = _json(output_data)
        system_content = "Ты анализируешь документы и извлекаешь проверяемые факты."

    if not assistant_content.strip():
        raise ValueError(f"task {task} has an empty assistant output")

    metadata = dict(record.get("metadata") or {})
    metadata.update(
        {
            "source_id": record.get("id"),
            "task": task,
            "split": record.get("split", "train"),
        }
    )
    return {
        "task": task,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        ],
        "metadata": metadata,
    }
