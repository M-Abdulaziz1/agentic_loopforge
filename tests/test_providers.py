from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider


def test_fake_llm_provider_returns_deterministic_response() -> None:
    provider = FakeLLMProvider()

    response = provider.complete(system="planner", prompt="Create a loop")

    assert response.text.startswith("FAKE_RESPONSE")
    assert response.tokens_used > 0


def test_fake_sandbox_provider_records_code_without_host_execution() -> None:
    provider = FakeSandboxProvider()

    result = provider.run_code("print('hello')", timeout_seconds=3)

    assert result.exit_code == 0
    assert result.stdout == "sandbox execution simulated"
    assert provider.executions == ["print('hello')"]
