"""Validate a JSONL dataset before it is used for training."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from src.dataset_pipeline import load_jsonl, validate_records  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    args = parser.parse_args()

    try:
        records = load_jsonl(args.dataset)
    except (OSError, ValueError) as exc:
        print(f"dataset cannot be loaded: {exc}", file=sys.stderr)
        return 2

    errors = validate_records(records)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print(f"valid: {len(records)} records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
