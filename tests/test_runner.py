import subprocess
import sys
import tempfile

from api.loopforge.domain import Budget, Goal, LoopSpec, LoopSpecAgent, RunStatus, ToolPermission
from api.loopforge.providers import LLMResponse, SandboxResult, SandboxSession
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


class StaticLLM:
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        return LLMResponse(text='{"tool":"finish","summary":"done"}', tokens_used=1)


class LocalWorkspaceSandbox:
    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount=None) -> SandboxResult:
        return SandboxResult(exit_code=0, stdout="")

    def open_session(self, *, dataset_mount=None) -> SandboxSession:
        workspace = Path(tempfile.mkdtemp(prefix="lf-runner-test-"))
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)

        def exec_python(ws: Path, code: str, timeout: int) -> SandboxResult:
            script = ws / "main.py"
            script.write_text(code, encoding="utf-8")
            completed = subprocess.run([sys.executable, str(script)], cwd=ws, timeout=timeout, capture_output=True, text=True, check=False)
            return SandboxResult(exit_code=completed.returncode, stdout=completed.stdout, stderr=completed.stderr)

        return SandboxSession(workspace=workspace, exec_python=exec_python)


from pathlib import Path


def make_spec(goal_id: str) -> LoopSpec:
    return LoopSpec(
        goal_id=goal_id,
        version=1,
        agents=[LoopSpecAgent(name="Executor", role="Execute", system_prompt="Do the work", tools=["local_workspace"])],
        tool_permissions=[ToolPermission(tool_name="local_workspace", enabled=True, reason="Store artifacts")],
        handoffs=[],
        success_criteria=["Result exists"],
        failure_criteria=["No result"],
        gates=["before_run"],
        context_policy={"max_context_tokens": 1000},
        improvement_strategy="Revise once",
        status="approved",
    )


def test_runner_pauses_at_configured_gate_and_records_contract_events() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI"))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=StaticLLM(),
        sandbox=LocalWorkspaceSandbox(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.PENDING_APPROVAL
    assert store.list_gates(run_id=run.id)[0].status == "pending"
    assert [event.type for event in store.list_events(run.id)] == [
        "node_start",
        "gate_pending",
        "run_status",
    ]


def test_runner_stops_when_step_budget_is_exhausted() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI", budget=Budget(max_steps=1)))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=StaticLLM(),
        sandbox=LocalWorkspaceSandbox(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.BUDGET_EXHAUSTED
    assert store.list_events(run.id)[-1].type == "run_status"
