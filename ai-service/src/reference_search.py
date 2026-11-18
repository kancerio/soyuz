"""Source lookup for construction terminology using Wikipedia's public REST API."""

from __future__ import annotations

import html
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

from .llm_provider import LLMProviderError, LLMProviderTimeout, ProviderUnavailableError


_TAG_RE = re.compile(r"<[^>]+>")


async def search_wikipedia_term(
    term: str,
    source_language: str,
    country_code: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, str] | None:
    """Return one source-backed page summary, or None when no article matches."""

    language = source_language.lower()
    if language not in {
        "ru", "en", "de", "fr", "es", "zh", "ar", "pt", "it", "nl", "pl",
        "uk", "tr", "ja", "ko", "hi", "fa", "sv", "da", "no", "fi", "cs",
        "el", "he", "id", "vi", "th",
    }:
        raise LLMProviderError("Unsupported Wikipedia source language")

    base_url = os.getenv(
        "WIKIPEDIA_API_BASE_URL", f"https://{language}.wikipedia.org/w/rest.php/v1"
    ).rstrip("/")
    headers = {
        "Accept": "application/json",
        "User-Agent": "SoyuzMessenger/0.1 (construction term references)",
    }
    try:
        timeout = float(os.getenv("CONSTRUCTION_REFERENCE_TIMEOUT_SECONDS", "8"))
        async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
            response = await client.get(
                f"{base_url}/search/page",
                params={"q": f"{term} {country_code}", "limit": 1},
                headers=headers,
            )
    except httpx.TimeoutException as exc:
        raise LLMProviderTimeout("Construction reference search timed out") from exc
    except httpx.ConnectError as exc:
        raise ProviderUnavailableError(
            "Construction reference search is unavailable"
        ) from exc
    except httpx.HTTPError as exc:
        raise LLMProviderError("Construction reference search failed") from exc

    if response.status_code == 404:
        return None
    if response.status_code in {429, 502, 503, 504}:
        raise ProviderUnavailableError(
            f"Construction reference search returned HTTP {response.status_code}"
        )
    if response.is_error:
        raise LLMProviderError(
            f"Construction reference search returned HTTP {response.status_code}"
        )

    try:
        pages: Any = response.json().get("pages", [])
    except (ValueError, AttributeError) as exc:
        raise LLMProviderError("Construction reference search returned invalid data") from exc
    if not isinstance(pages, list) or not pages:
        return None

    page = pages[0]
    if not isinstance(page, dict):
        return None
    title = page.get("title")
    key = page.get("key")
    description = page.get("description")
    excerpt = page.get("excerpt")
    if not isinstance(title, str) or not isinstance(key, str):
        return None

    extract_parts = []
    if isinstance(description, str) and description.strip():
        extract_parts.append(description.strip())
    if isinstance(excerpt, str) and excerpt.strip():
        plain_excerpt = html.unescape(_TAG_RE.sub("", excerpt)).strip()
        if plain_excerpt and plain_excerpt not in extract_parts:
            extract_parts.append(plain_excerpt)
    extract = "\n".join(extract_parts)[:1200]
    if not extract:
        return None

    page_key = quote(key.replace(" ", "_"), safe="()_/-")
    return {
        "title": title.strip(),
        "url": f"https://{language}.wikipedia.org/wiki/{page_key}",
        "extract": extract,
        "language": language,
    }
