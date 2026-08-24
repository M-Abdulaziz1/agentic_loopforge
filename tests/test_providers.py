import subprocess

import httpx
import pytest

from api.loopforge.providers import DockerGvisorSandboxProvider, OpenAICompatibleLLMProvider, SandboxProviderError


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


def test_open_session_makes_workspace_and_output_writable_by_container_uid(tmp_path) -> None:
    # The non-root container (uid 65532) must be able to write outputs; the host
    # creates these dirs, so they need world-writable perms or the agent's saves fail.
    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=lambda c, t: None)
    session = provider.open_session()
    for sub in ("", "output", "data"):
        d = session.workspace / sub if sub else session.workspace
        assert (d.stat().st_mode & 0o777) == 0o777, f"{sub or 'workspace'} not world-writable"


def test_docker_gvisor_provider_raises_for_missing_runtime(tmp_path) -> None:
    def runner(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            command,
            125,
            stdout="",
            stderr="docker: Error response from daemon: unknown or invalid runtime name: runsc\n",
        )

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=runner)

    with pytest.raises(SandboxProviderError, match="runsc"):
        provider.run_code("print('hello')", timeout_seconds=3)
