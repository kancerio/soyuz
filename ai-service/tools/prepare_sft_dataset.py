"""Convert validated task JSONL into chat-style SFT JSONL."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from src.sft_dataset import to_sft_record  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    converted = []
    for line_number, line in enumerate(
        args.input.read_text(encoding="utf-8").splitlines(), 1
    ):
        if not line.strip():
            continue
        try:
            converted.append(to_sft_record(json.loads(line)))
        except (ValueError, json.JSONDecodeError) as exc:
            print(f"line {line_number}: {exc}", file=sys.stderr)
            return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in converted),
        encoding="utf-8",
    )
    print(f"wrote {len(converted)} SFT records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
