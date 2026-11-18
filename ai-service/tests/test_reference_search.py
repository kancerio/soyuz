import asyncio
import httpx
import pytest

from src.llm_provider import LLMProviderTimeout, ProviderUnavailableError
from src.reference_search import search_wikipedia_term


def test_search_uses_source_language_wiki_country_context_and_safe_wiki_url():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["user_agent"] = request.headers.get("user-agent")
        return httpx.Response(
            200,
            json={
                "pages": [
                    {
                        "id": 12,
                        "key": "Армирование бетона",
                        "title": "Армирование бетона",
                        "description": "Способ усиления бетонной конструкции.",
                        "excerpt": "Усиление <span class=\"searchmatch\">бетона</span> сталью.",
                    }
                ]
            },
        )

    result = asyncio.run(
        search_wikipedia_term(
            "армирование",
            "ru",
            "RU",
            transport=httpx.MockTransport(handler),
        )
    )

    assert "https://ru.wikipedia.org/w/rest.php/v1/search/page" in seen["url"]
    assert "q=%D0%B0%D1%80%D0%BC%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5+RU" in seen["url"]
    assert seen["user_agent"].startswith("SoyuzMessenger/")
    assert result == {
        "title": "Армирование бетона",
        "url": "https://ru.wikipedia.org/wiki/%D0%90%D1%80%D0%BC%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5_%D0%B1%D0%B5%D1%82%D0%BE%D0%BD%D0%B0",
        "extract": "Способ усиления бетонной конструкции.\nУсиление бетона сталью.",
        "language": "ru",
    }


def test_search_returns_none_when_no_article_matches():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"pages": []})

    result = asyncio.run(
        search_wikipedia_term(
            "несуществующий термин", "ru", "RU", transport=httpx.MockTransport(handler)
        )
    )

    assert result is None


def test_search_treats_wikipedia_404_as_no_matching_source():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    result = asyncio.run(
        search_wikipedia_term(
            "термин", "ru", "RU", transport=httpx.MockTransport(handler)
        )
    )

    assert result is None


def test_search_maps_remote_rate_limit_to_provider_unavailable():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    with pytest.raises(ProviderUnavailableError, match="HTTP 503"):
        asyncio.run(
            search_wikipedia_term(
                "термин", "ru", "RU", transport=httpx.MockTransport(handler)
            )
        )


def test_search_maps_remote_timeout_to_provider_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    with pytest.raises(LLMProviderTimeout, match="search timed out"):
        asyncio.run(
            search_wikipedia_term(
                "термин", "ru", "RU", transport=httpx.MockTransport(handler)
            )
        )
