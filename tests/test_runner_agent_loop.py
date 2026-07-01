import json
import tempfile
from pathlib import Path

from api.loopforge.domain import Goal, LoopSpec, LoopSpecAgent
from api.loopforge.providers import LLMResponse, SandboxResult, SandboxSession
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


class SequenceLLM:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls: list[tuple[str, str]] = []

    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        self.calls.append((system, prompt))
        return LLMResponse(text=self.responses.pop(0), tokens_used=7)


class ScriptedSandbox:
    """A real persistent workspace (so file I/O truly persists) with scripted code output."""

    def __init__(self, outputs: list[SandboxResult] | None = None) -> None:
        self.outputs = list(outputs or [])
        self.ran: list[str] = []

    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount=None) -> SandboxResult:
        return SandboxResult(exit_code=0, stdout="", stderr="")

    def open_session(self, *, dataset_mount=None) -> SandboxSession:
        root = Path(tempfile.mkdtemp(prefix="lf-test-"))
        (root / "data").mkdir(parents=True, exist_ok=True)
        (root / "output").mkdir(parents=True, exist_ok=True)

        def exec_python(_ws: Path, code: str, _timeout: int) -> SandboxResult:
            self.ran.append(code)
            return self.outputs.pop(0) if self.outputs else SandboxResult(exit_code=0, stdout="ran", stderr="")

        return SandboxSession(workspace=root, exec_python=exec_python)


def _spec(goal_id: str, agents: list[LoopSpecAgent], success: list[str]) -> LoopSpec:
    return LoopSpec(
        goal_id=goal_id,
        version=1,
        agents=agents,
        tool_permissions=[],
        handoffs=[{"from": agents[i].name, "to": agents[i + 1].name} for i in range(len(agents) - 1)],
        success_criteria=success,
        failure_criteria=["No validated result"],
        gates=[],
        context_policy={"max_context_tokens": 8000},
        improvement_strategy="Revise once",
        status="approved",
    )


def test_agent_observes_real_execution_output_and_persists_grounded_artifacts() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Analyze the dataset for a trend", autonomy="autonomous"))
    agent = LoopSpecAgent(name="Analyst", role="analyze", system_prompt="Analyze the data.", tools=["code_sandbox"])
    spec = store.save_loop_spec(_spec(goal.id, [agent], ["Report answers the goal"]))
    llm = SequenceLLM(
        [
            json.dumps({"thought": "profile", "tool": "run_python", "code": "import pandas as pd; print('rows', 100)"}),
            json.dumps(
                {
                    "thought": "done",
                    "tool": "finish",
                    "summary": "Observed 100 rows; a significant upward trend.",
                    "insights": [{"claim": "X rose", "test": "t_test", "p_value": 0.01, "effect_name": "delta", "effect_value": 0.5, "n": 50}],
                }
            ),
        ]
    )
    sandbox = ScriptedSandbox([SandboxResult(exit_code=0, stdout="rows 100\n", stderr="")])

    run = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=default_tool_registry()).start(goal, spec)

    assert run.status == "completed"
    assert sandbox.ran and "pandas" in sandbox.ran[0]
    kinds = {a.kind for a in store.list_artifacts(run.id)}
    assert {"code", "report", "insight"} <= kinds
    # The feedback loop is real: the finish turn's prompt contained the actual stdout.
    assert "rows 100" in llm.calls[1][1]
    tool_events = [e for e in store.list_events(run.id) if e.type == "tool_call"]
    assert any(e.payload.get("exit_code") == 0 for e in tool_events)


def test_workspace_files_persist_between_steps() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Write then read a file", autonomy="autonomous"))
    agent = LoopSpecAgent(name="Worker", role="work", system_prompt="Work.", tools=["code_sandbox"])
    spec = store.save_loop_spec(_spec(goal.id, [agent], ["ok"]))
    llm = SequenceLLM(
        [
            json.dumps({"thought": "save", "tool": "write_file", "path": "output/note.txt", "content": "hello-persist"}),
            json.dumps({"thought": "read", "tool": "read_file", "path": "output/note.txt"}),
            json.dumps({"thought": "done", "tool": "finish", "summary": "Read the note back."}),
        ]
    )

    run = LoopRunner(store=store, llm=llm, sandbox=ScriptedSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "completed"
    # Step 3's prompt shows the content written in step 1 and read in step 2 — real persistence.
    assert "hello-persist" in llm.calls[2][1]


def test_reading_missing_file_reports_not_found_instead_of_fabricating() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Read metrics", autonomy="autonomous"))
    agent = LoopSpecAgent(name="Reader", role="read", system_prompt="Read.", tools=["code_sandbox"])
    spec = store.save_loop_spec(_spec(goal.id, [agent], ["ok"]))
    llm = SequenceLLM(
        [
            json.dumps({"thought": "check", "tool": "read_file", "path": "output/metrics.json"}),
            json.dumps({"thought": "honest", "tool": "finish", "summary": "No metrics were produced."}),
        ]
    )

    run = LoopRunner(store=store, llm=llm, sandbox=ScriptedSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "completed"
    assert "File not found" in llm.calls[1][1]


def test_two_agents_share_workspace_and_validate_a_real_model() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Train and verify a fraud model", autonomy="autonomous"))
    agents = [
        LoopSpecAgent(name="MLBuilder", role="build", system_prompt="Train a candidate model.", tools=["code_sandbox"]),
        LoopSpecAgent(name="Verifier", role="verify", system_prompt="Verify the candidate model.", tools=["code_sandbox"]),
    ]
    spec = store.save_loop_spec(_spec(goal.id, agents, ["Verifier confirms recall target"]))
    model = {"name": "fraud", "metric_name": "roc_auc", "metric_value": 0.98, "baseline_value": 0.5, "beats_baseline": True, "leakage_ok": True}
    llm = SequenceLLM(
        [
            json.dumps({"thought": "train", "tool": "run_python", "code": "print('trained')"}),
            json.dumps({"thought": "done", "tool": "finish", "summary": "Model trained.", "models": [model]}),
            json.dumps({"thought": "verify", "tool": "run_python", "code": "print('verified')"}),
            json.dumps({"thought": "done", "tool": "finish", "summary": "Recall target met.", "models": [model]}),
        ]
    )

    run = LoopRunner(store=store, llm=llm, sandbox=ScriptedSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "completed"
    assert {e.payload.get("agent") for e in store.list_events(run.id) if e.type == "node_end"} == {"MLBuilder", "Verifier"}
    assert "model" in {a.kind for a in store.list_artifacts(run.id)}


def test_run_fails_when_real_llm_never_returns_a_valid_action() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Train a fraud model", autonomy="autonomous"))
    agent = LoopSpecAgent(name="Analyst", role="analyze", system_prompt="Analyze.", tools=["code_sandbox"])
    spec = store.save_loop_spec(_spec(goal.id, [agent], ["ok"]))
    llm = SequenceLLM(["I will train the model now.", "Still not JSON."])

    run = LoopRunner(store=store, llm=llm, sandbox=ScriptedSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "failed"
    assert run.result_summary == "Agent never returned a valid JSON action."
    assert store.list_artifacts(run.id) == []
    assert [event.type for event in store.list_events(run.id)][-1] == "run_status"
