import os
import sys
from typing import Any

import httpx

BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:8001").rstrip("/")


def request_case(
    client: httpx.Client,
    *,
    name: str,
    path: str,
    payload: dict[str, Any],
    expected_status: int,
    expected_action: str | None = None,
) -> bool:
    response = client.post(path, json=payload)
    body = response.json()
    passed = response.status_code == expected_status
    if expected_action is not None:
        passed = passed and body.get("action") == expected_action
        passed = passed and body.get("mock") is True
    if expected_status == 422:
        passed = passed and body.get("error", {}).get("code") == "validation_error"

    state = "PASS" if passed else "FAIL"
    print(f"{state}: {name} (HTTP {response.status_code})")
    if not passed:
        print(body)
    return passed


def main() -> int:
    cases = []
    with httpx.Client(base_url=BASE_URL, timeout=5) as client:
        cases.append(
            request_case(
                client,
                name="translate success",
                path="/translate",
                payload={"text": "Hello", "source_lang": "en", "target_lang": "ru"},
                expected_status=200,
                expected_action="translate",
            )
        )
        cases.append(
            request_case(
                client,
                name="translate rejects empty text",
                path="/translate",
                payload={"text": " ", "target_lang": "ru"},
                expected_status=422,
            )
        )
        for action in ("shorten", "formal", "friendly"):
            cases.append(
                request_case(
                    client,
                    name=f"assist {action}",
                    path="/assist",
                    payload={"text": "Send the report", "action": action},
                    expected_status=200,
                    expected_action=action,
                )
            )
        cases.append(
            request_case(
                client,
                name="assist rejects unknown action",
                path="/assist",
                payload={"text": "Hello", "action": "suggest"},
                expected_status=422,
            )
        )

    passed = sum(cases)
    print(f"Passed: {passed}/{len(cases)}")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
