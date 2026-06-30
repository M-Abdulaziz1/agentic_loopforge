import subprocess

import pytest

from api.loopforge.providers import DockerGvisorSandboxProvider, SandboxProviderError


def test_docker_gvisor_provider_builds_constrained_docker_command(tmp_path) -> None:
    seen: dict[str, object] = {}

    def runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        seen["command"] = command
        seen["timeout"] = timeout
        return subprocess.CompletedProcess(command, 0, stdout="hello\n", stderr="")

    provider = DockerGvisorSandboxProvider(
        runtime="runsc",
        image="python:3.12-slim",
        workspace_root=tmp_path,
        network="none",
        memory="256m",
        cpus="0.5",
        command_runner=runner,
    )

    result = provider.run_code("print('hello')", timeout_seconds=7)
    command = seen["command"]

    assert result.exit_code == 0
    assert result.stdout == "hello\n"
    assert seen["timeout"] == 7
    assert command[:3] == ["docker", "run", "--rm"]
    assert "--runtime=runsc" in command
    assert "--network=none" in command
    assert "--read-only" in command
    assert "--security-opt=no-new-privileges" in command
    assert "--cap-drop=ALL" in command
    assert "--memory=256m" in command
    assert "--cpus=0.5" in command
    assert any(mount.endswith(":/workspace:rw") for mount in command)
    assert "python:3.12-slim" in command


def test_docker_gvisor_provider_mounts_dataset_read_only_under_workspace_data(tmp_path) -> None:
    seen: dict[str, object] = {}
    dataset = tmp_path / "customers.csv"
    dataset.write_text("email\nmasked@example.com\n", encoding="utf-8")

    def runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        seen["command"] = command
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path / "workspaces", command_runner=runner)

    provider.run_code("print('ok')", timeout_seconds=3, dataset_mount={"host_path": dataset, "filename": "customers.csv"})
    command = seen["command"]

    assert any(mount.endswith(":/workspace:rw") for mount in command)
    assert f"{dataset}:/workspace/data/customers.csv:ro" in command


def test_docker_gvisor_provider_raises_clear_error_on_timeout(tmp_path) -> None:
    def runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        raise subprocess.TimeoutExpired(command, timeout)

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=runner)

    with pytest.raises(SandboxProviderError, match="timed out"):
        provider.run_code("while True: pass", timeout_seconds=1)


def test_docker_gvisor_provider_returns_nonzero_exit_with_stderr(tmp_path) -> None:
    def runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 2, stdout="", stderr="blocked")

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=runner)

    result = provider.run_code("raise SystemExit(2)", timeout_seconds=3)

    assert result.exit_code == 2
    assert result.stderr == "blocked"
