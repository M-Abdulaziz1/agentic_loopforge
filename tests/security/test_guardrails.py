import subprocess

from fastapi.testclient import TestClient

from api.loopforge import app as app_module
from api.loopforge.app import create_app
from api.loopforge.providers import DockerGvisorSandboxProvider, LLMProviderError
from api.loopforge.settings import Settings


class FailingProvider:
    def complete(self, *, system: str, prompt: str):
        raise LLMProviderError("Bearer should-not-leak failed")


def test_dataset_profiles_and_planner_context_mask_raw_pii(monkeypatch, tmp_path) -> None:
    calls: list[tuple[str, str]] = []

    class RecordingLLM:
        def complete(self, *, system: str, prompt: str):
            from api.loopforge.providers import LLMResponse

            calls.append((system, prompt))
            # Valid spec JSON so the real planner path produces a spec (no offline fallback).
            return LLMResponse(
                text=(
                    '{"agents": [{"name": "Analyst", "role": "analyze", '
                    '"system_prompt": "Use the goal as data.", "tools": ["local_workspace"]}], '
                    '"tool_permissions": [], "handoffs": [], "success_criteria": ["s"], '
                    '"failure_criteria": ["f"], "context_policy": {}, "improvement_strategy": "i"}'
                ),
                tokens_used=1,
            )

    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: RecordingLLM())
    client = TestClient(app_module.create_app(settings=Settings(dataset_storage_path=str(tmp_path / "datasets"))))
    dataset = client.post(
        "/api/datasets",
        files={"file": ("customers.csv", b"email\nprivate@example.com\n", "text/csv")},
    )

    goal = client.post(
        "/api/goals",
        json={"text": "Analyze uploaded customer data for validated insights", "dataset_id": dataset.json()["id"]},
    )

    assert dataset.status_code == 201
    assert goal.status_code == 201
    assert "private@example.com" not in dataset.text
    assert all("private@example.com" not in prompt for _, prompt in calls)


def test_docker_gvisor_dataset_mount_is_read_only(tmp_path) -> None:
    seen: dict[str, object] = {}
    dataset = tmp_path / "data.csv"
    dataset.write_text("x\n1\n", encoding="utf-8")

    def runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        seen["command"] = command
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path / "workspaces", command_runner=runner)
    provider.run_code("print('ok')", timeout_seconds=1, dataset_mount={"host_path": dataset, "filename": "data.csv"})

    command = seen["command"]
    assert any(item.endswith(":/workspace:rw") for item in command)
    assert f"{dataset}:/workspace/data/data.csv:ro" in command


def test_provider_test_redacts_api_key_in_failure(monkeypatch) -> None:
    monkeypatch.setattr(app_module, "create_llm_provider_from_config", lambda config, settings: FailingProvider())
    client = TestClient(create_app())
    provider = client.post(
        "/api/llm-providers",
        json={"name": "Local", "kind": "openai_compatible", "model": "local", "api_key": "should-not-leak"},
    ).json()

    response = client.post(f"/api/llm-providers/{provider['id']}/test")

    assert response.status_code == 200
    assert response.json()["ok"] is False
    assert "should-not-leak" not in response.text
