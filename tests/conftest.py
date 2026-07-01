import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from api.loopforge.providers import LLMResponse, SandboxResult, SandboxSession


class DeterministicPlannerLLM:
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        if "Available tools" in system:
            return LLMResponse(text=json.dumps({"tool": "finish", "summary": ""}), tokens_used=5)

        if "Your only job in this step" in system:
            if "make it better" in prompt.lower() or "do something useful" in prompt.lower():
                text = json.dumps(
                    {
                        "status": "needs_clarification",
                        "clarity_score": 0.35,
                        "missing_requirements": ["desired outcome", "success criteria"],
                        "questions": [
                            {
                                "question": "What specific outcome should the loop produce?",
                                "missing_requirement": "desired outcome",
                                "options": ["A checklist", "A validated model"],
                            }
                        ],
                    }
                )
            else:
                text = json.dumps({"status": "ready", "clarity_score": 0.95, "missing_requirements": [], "questions": []})
            return LLMResponse(text=text, tokens_used=11)

        text = json.dumps(
            {
                "agents": [
                    {
                        "name": "Executor",
                        "role": "Execute the approved local goal",
                        "system_prompt": "Use the approved tools to produce the requested local artifact. Finish honestly when complete.",
                        "tools": ["local_workspace", "code_sandbox"],
                    }
                ],
                "tool_permissions": [
                    {"tool_name": "local_workspace", "enabled": True, "reason": "Persist artifacts"},
                    {"tool_name": "code_sandbox", "enabled": True, "reason": "Run generated code safely"},
                    {"tool_name": "web_search", "enabled": False, "reason": "Internet disabled"},
                ],
                "handoffs": [],
                "success_criteria": ["Result directly answers the goal"],
                "failure_criteria": ["The result cannot be produced within budget"],
                "context_policy": {"max_context_tokens": 8000},
                "improvement_strategy": "Revise within budget if validation fails.",
            }
        )
        return LLMResponse(text=text, tokens_used=17)


class LocalSubprocessSandbox:
    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount=None) -> SandboxResult:
        with tempfile.TemporaryDirectory(prefix="lf-api-test-run-") as tmp:
            workspace = Path(tmp)
            return self._execute(workspace, code, timeout_seconds)

    def open_session(self, *, dataset_mount=None) -> SandboxSession:
        workspace = Path(tempfile.mkdtemp(prefix="lf-api-test-"))
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)

        def exec_python(ws: Path, code: str, timeout: int) -> SandboxResult:
            return self._execute(ws, code, timeout)

        return SandboxSession(workspace=workspace, exec_python=exec_python)

    def _execute(self, workspace: Path, code: str, timeout: int) -> SandboxResult:
        script = workspace / "main.py"
        script.write_text(code, encoding="utf-8")
        completed = subprocess.run(
            [sys.executable, str(script)],
            cwd=workspace,
            timeout=timeout,
            capture_output=True,
            text=True,
            check=False,
        )
        return SandboxResult(exit_code=completed.returncode, stdout=completed.stdout, stderr=completed.stderr)


@pytest.fixture(autouse=True)
def deterministic_app_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.loopforge import app as app_module

    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: DeterministicPlannerLLM())
    monkeypatch.setattr(app_module, "create_execution_sandbox_provider", lambda settings, llm, goal: LocalSubprocessSandbox())


@pytest.fixture
def clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOOPFORGE_LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LOOPFORGE_LLM_API_KEY", raising=False)
