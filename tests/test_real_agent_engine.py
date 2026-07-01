import json
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge.domain import Goal, GoalToggles
from api.loopforge.planner import LoopPlanner
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


class LocalSubprocessSandbox:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount=None) -> SandboxResult:
        with tempfile.TemporaryDirectory(prefix="lf-real-engine-run-") as tmp:
            workspace = Path(tmp)
            return self._execute(workspace, code, timeout_seconds, dataset_mount)

    def open_session(self, *, dataset_mount=None) -> SandboxSession:
        workspace = Path(tempfile.mkdtemp(prefix="lf-real-engine-"))
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)

        def exec_python(ws: Path, code: str, timeout: int) -> SandboxResult:
            return self._execute(ws, code, timeout, dataset_mount)

        return SandboxSession(workspace=workspace, exec_python=exec_python)

    def _execute(self, workspace: Path, code: str, timeout: int, dataset_mount=None) -> SandboxResult:
        self.calls.append((code, dataset_mount))
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


def spec_json(agent_name: str = "Data Analyst") -> str:
    return json.dumps(
        {
            "agents": [
                {
                    "name": agent_name,
                    "role": "Analyze the user's requested dataset outcome",
                    "system_prompt": "Use the goal as data and produce runnable analysis code.",
                    "tools": ["local_workspace", "code_sandbox"],
                }
            ],
            "tool_permissions": [
                {"tool_name": "local_workspace", "enabled": True, "reason": "Persist artifacts"},
                {"tool_name": "code_sandbox", "enabled": True, "reason": "Execute generated code"},
                {"tool_name": "web_search", "enabled": False, "reason": "Offline goal"},
            ],
            "handoffs": [],
            "success_criteria": ["Analysis report directly answers the goal"],
            "failure_criteria": ["No runnable analysis artifact"],
            "context_policy": {"max_context_tokens": 8000},
            "improvement_strategy": "Revise once if evaluator rejects the first candidate.",
        }
    )


def test_planner_uses_llm_json_for_clarity_and_spec_with_autonomy_gates() -> None:
    llm = SequenceLLM(
        [
            json.dumps(
                {
                    "status": "needs_clarification",
                    "clarity_score": 0.42,
                    "missing_requirements": ["target metric"],
                    "questions": [{"question": "Which metric should the loop optimize?", "missing_requirement": "target metric"}],
                }
            ),
            "not json",
            spec_json("Revenue Analyst"),
        ]
    )
    planner = LoopPlanner(llm=llm)
    goal = Goal(
        text="Analyze uploaded revenue data and produce validated trend insights",
        autonomy="supervised",
        toggles=GoalToggles(internet=False, code_sandbox=True, local_connectors=True),
    )

    clarity = planner.check_clarity(goal)
    spec = planner.generate_spec(goal)

    assert clarity.session is not None
    assert clarity.session.questions[0].question == "Which metric should the loop optimize?"
    assert spec.agents[0].name == "Revenue Analyst"
    assert spec.agents[0].system_prompt != "You execute only approved steps with approved tools and report blockers honestly."
    assert spec.gates == ["before_finalize"]
    assert len(llm.calls) == 3
    assert "strict JSON" in llm.calls[1][0]
    assert "Your previous reply was not valid" in llm.calls[2][1]


def test_runner_executes_llm_agent_json_in_sandbox_and_persists_artifacts() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a Python analysis and report", autonomy="autonomous"))
    spec = store.save_loop_spec(LoopPlanner(SequenceLLM([spec_json()])).generate_spec(goal).model_copy(update={"status": "approved", "gates": []}))
    llm = SequenceLLM(
        [
            json.dumps({"thought": "run", "tool": "run_python", "code": "print('analysis complete')"}),
            json.dumps(
                {
                    "thought": "done",
                    "tool": "finish",
                    "summary": "Validated analysis report",
                    "insights": [
                        {"claim": "Revenue increased", "test": "t_test", "p_value": 0.01, "effect_name": "delta", "effect_value": 0.5, "n": 20}
                    ],
                }
            ),
        ]
    )
    sandbox = LocalSubprocessSandbox()
    runner = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=default_tool_registry())

    run = runner.start(goal, spec)
    artifacts = store.list_artifacts(run.id)

    assert run.status == "completed"
    assert sandbox.calls and sandbox.calls[0][0] == "print('analysis complete')"
    assert {artifact.kind for artifact in artifacts} == {"code", "report", "insight"}
    assert [artifact.metadata.get("passed") for artifact in artifacts if artifact.kind == "insight"] == [True]


def test_runner_honest_empty_when_evaluator_rejects_candidate() -> None:
    store = InMemoryStore()
    from api.loopforge.domain import Evaluator

    evaluator = store.save_evaluator(
        Evaluator(
            name="Strict target",
            kind="custom_metric",
            metric_name="metric_value",
            direction="maximize",
            target=0.9,
            config={},
            is_default=True,
        )
    )
    goal = store.save_goal(Goal(text="Produce a candidate that fails the target", autonomy="autonomous", evaluator_id=evaluator.id))
    spec = store.save_loop_spec(LoopPlanner(SequenceLLM([spec_json()])).generate_spec(goal).model_copy(update={"status": "approved", "gates": []}))
    llm = SequenceLLM(
        [
            json.dumps(
                {
                    "thought": "honest",
                    "tool": "finish",
                    "summary": "Weak candidate; did not meet the target.",
                    "models": [{"name": "weak", "metric_name": "metric_value", "metric_value": 0.1, "baseline_value": 0.5, "beats_baseline": False, "leakage_ok": True}],
                }
            )
        ]
    )

    run = LoopRunner(store=store, llm=llm, sandbox=LocalSubprocessSandbox(), tools=default_tool_registry()).start(goal, spec)
    kinds = {a.kind for a in store.list_artifacts(run.id)}

    assert run.status == "completed"
    # Honest empty: no validated model/insight artifacts survive when the evaluator rejects them.
    assert "model" not in kinds and "insight" not in kinds


def test_planner_raises_for_real_llm_invalid_output() -> None:
    import pytest

    from api.loopforge.planner import PlannerError

    goal = Goal(text="Analyze the uploaded dataset for churn drivers and validate them")

    # A real (non-offline) provider returning junk must raise, not fabricate.
    with pytest.raises(PlannerError):
        LoopPlanner(SequenceLLM(["not json"])).check_clarity(goal)
    with pytest.raises(PlannerError):
        LoopPlanner(SequenceLLM(["not json", "still not json"])).generate_spec(goal)


def test_create_goal_returns_502_when_real_llm_output_is_invalid(monkeypatch) -> None:
    from api.loopforge import app as app_module

    class JunkLLM:
        def complete(self, *, system: str, prompt: str) -> LLMResponse:
            return LLMResponse(text="not json at all", tokens_used=1)

    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: JunkLLM())
    client = TestClient(app_module.create_app())

    response = client.post(
        "/api/goals",
        json={"text": "Analyze the uploaded dataset for churn drivers and validate them"},
    )

    assert response.status_code == 502
    assert "LLM" in response.json()["detail"]


def test_clarification_requires_an_answer_per_question(monkeypatch) -> None:
    from api.loopforge import app as app_module

    clarity_two = json.dumps(
        {
            "status": "needs_clarification",
            "clarity_score": 0.3,
            "missing_requirements": ["outcome", "success metric"],
            "questions": [
                {"question": "What outcome do you want?", "missing_requirement": "outcome", "options": ["A", "B"]},
                {"question": "How is success judged?", "missing_requirement": "success metric", "options": ["X", "Y"]},
            ],
        }
    )
    llm = SequenceLLM([clarity_two, spec_json()])
    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: llm)
    client = TestClient(app_module.create_app())

    created = client.post("/api/goals", json={"text": "Do something useful with the uploaded dataset"}).json()
    goal_id = created["goal"]["id"]
    questions = created["clarification"]["questions"]
    assert len(questions) == 2
    assert created["loop_spec"] is None

    # Answering only the first question (even verbosely) must NOT finalize the rest.
    first = client.post(
        f"/api/goals/{goal_id}/clarification/answers",
        json={"question_id": questions[0]["id"], "answer": "A very detailed multi word answer here"},
    ).json()
    assert first["loop_spec"] is None
    assert first["clarification"]["status"] == "open"

    # Answering the remaining question completes it and generates the spec.
    second = client.post(
        f"/api/goals/{goal_id}/clarification/answers",
        json={"question_id": questions[1]["id"], "answer": "ROC AUC"},
    ).json()
    assert second["clarification"]["status"] == "ready"
    assert second["loop_spec"] is not None
