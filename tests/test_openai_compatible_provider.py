import httpx
import pytest

from api.loopforge.providers import LLMProviderError, OpenAICompatibleLLMProvider


def test_openai_compatible_provider_posts_chat_completion_payload() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers["authorization"]
        seen["payload"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "planned loop"}}],
                "usage": {"total_tokens": 42},
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleLLMProvider(
        base_url="http://local-llm.test/v1",
        api_key="secret",
        model="local-model",
        client=client,
    )

    response = provider.complete(system="system prompt", prompt="user prompt")

    assert seen["url"] == "http://local-llm.test/v1/chat/completions"
    assert seen["authorization"] == "Bearer secret"
    assert '"model":"local-model"' in str(seen["payload"])
    assert response.text == "planned loop"
    assert response.tokens_used == 42


def test_openai_compatible_provider_uses_token_fallback_when_usage_missing() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "short answer"}}]})

    provider = OpenAICompatibleLLMProvider(
        base_url="http://cloud-compatible.test/v1/",
        api_key="secret",
        model="cloud-model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = provider.complete(system="system", prompt="prompt")

    assert response.text == "short answer"
    assert response.tokens_used > 0


def test_openai_compatible_provider_raises_clear_error_on_bad_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "bad"})

    provider = OpenAICompatibleLLMProvider(
        base_url="http://bad-provider.test/v1",
        api_key="secret",
        model="model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(LLMProviderError, match="500"):
        provider.complete(system="system", prompt="prompt")
