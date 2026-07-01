import subprocess

import httpx

from api.loopforge.providers import DockerGvisorSandboxProvider, OpenAICompatibleLLMProvider


def test_openai_compatible_provider_reads_real_chat_completion_shape() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer secret"
        payload = request.read().decode()
        assert "qwen" in payload
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "{\"status\":\"ready\"}"}}],
                "usage": {"total_tokens": 11},
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleLLMProvider(base_url="http://local.test/v1", api_key="secret", model="qwen", client=client)

    response = provider.complete(system="planner", prompt="Create a loop")

    assert response.text == '{"status":"ready"}'
    assert response.tokens_used == 11


def test_docker_gvisor_provider_builds_hardened_real_execution_command(tmp_path) -> None:
    commands: list[list[str]] = []

    def runner(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="real stdout", stderr="")

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=runner)
    result = provider.run_code("print('hello')", timeout_seconds=3)

    command = commands[0]
    assert result.stdout == "real stdout"
    assert command[:3] == ["docker", "run", "--rm"]
    assert "--runtime=runsc" in command
    assert "--read-only" in command
    assert "--cap-drop=ALL" in command
    assert any(part.endswith(":/workspace:rw") for part in command)
    assert result.stdout != ""
