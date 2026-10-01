"""Generate reviewable synthetic examples with the DeepSeek Open Platform."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from src.dataset_pipeline import (  # noqa: E402
    SUPPORTED_LANGUAGES,
    build_generation_prompt,
    normalize_generated_examples,
    validate_records,
)


def request_deepseek(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    timeout: int = 120,
) -> dict:
    """Request one structured batch without logging the API key or prompt data."""

    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Ты создаёшь проверяемые учебные примеры для внутреннего датасета.",
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"DeepSeek API returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DeepSeek API request failed: {exc.reason}") from exc

    try:
        content = response_body["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("DeepSeek API returned an invalid structured response") from exc
    if not isinstance(parsed, (dict, list)):
        raise RuntimeError("DeepSeek API response must be a JSON object or array")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task", required=True, choices=["translate", "assist", "summary", "document_analysis"])
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--split", choices=["train", "validation", "test"], default="train")
    parser.add_argument("--model", default=os.getenv("DEEPSEEK_MODEL"))
    parser.add_argument("--base-url", default=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        parser.error("DEEPSEEK_API_KEY is required in the environment")
    if not args.model:
        parser.error("--model or DEEPSEEK_MODEL is required; do not assume a model")

    prompt = build_generation_prompt(args.task, sorted(SUPPORTED_LANGUAGES), args.count)
    raw_response = request_deepseek(
        api_key=api_key,
        base_url=args.base_url,
        model=args.model,
        prompt=prompt,
    )
    records = normalize_generated_examples(
        raw_response,
        task=args.task,
        split=args.split,
        model=args.model,
    )
    errors = validate_records(records)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )
    print(f"wrote {len(records)} unreviewed records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
