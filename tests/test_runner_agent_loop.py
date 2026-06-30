import json

from api.loopforge.domain import Goal, LoopSpecAgent
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import LLMResponse, SandboxResult
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


class RecordingSandbox:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount=None) -> SandboxResult:
        self.calls.append((code, dataset_mount))
        return SandboxResult(exit_code=0, stdout="sandbox ok", stderr="")


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
            ],
            "handoffs": [],
            "success_criteria": ["Analysis report directly answers the goal"],
            "failure_criteria": ["No runnable analysis artifact"],
            "context_policy": {"max_context_tokens": 8000},
            "improvement_strategy": "Revise once if evaluator rejects the first candidate.",
        }
    )


def test_runner_executes_all_spec_agents_in_sequence_for_ml_loop() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Train a fraud detection model", autonomy="autonomous"))
    spec = store.save_loop_spec(
        LoopPlanner(SequenceLLM([spec_json("MLBuilder")]))
        .generate_spec(goal)
        .model_copy(
            update={
                "status": "approved",
                "gates": [],
                "agents": [
                    LoopSpecAgent(
                        name="MLBuilder",
                        role="Build fraud model",
                        system_prompt="Train a candidate model and return code plus metrics.",
                        tools=["code_sandbox"],
                    ),
                    LoopSpecAgent(
                        name="Verifier",
                        role="Verify fraud model",
                        system_prompt="Verify the candidate model meets fraud metrics.",
                        tools=["code_sandbox"],
                    ),
                ],
                "handoffs": [{"from": "MLBuilder", "to": "Verifier"}],
                "success_criteria": ["Verifier confirms fraud recall target"],
            }
        )
    )
    llm = SequenceLLM(
        [
            json.dumps(
                {
                    "code": "print('train fraud model')",
                    "report": "Candidate model trained",
                    "models": [
                        {
                            "name": "fraud_model",
                            "metric_name": "roc_auc",
                            "metric_value": 0.98,
                            "baseline_value": 0.5,
                            "beats_baseline": True,
                            "leakage_ok": True,
                        }
                    ],
                }
            ),
            json.dumps(
                {
                    "report": "Verifier confirmed recall target",
                    "models": [
                        {
                            "name": "fraud_model",
                            "metric_name": "recall",
                            "metric_value": 0.84,
                            "baseline_value": 0.1,
                            "beats_baseline": True,
                            "leakage_ok": True,
                        }
                    ],
                }
            ),
        ]
    )

    run = LoopRunner(store=store, llm=llm, sandbox=RecordingSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "completed"
    assert [call[0].split("\n", 1)[0] for call in llm.calls] == [
        "Train a candidate model and return code plus metrics.",
        "Verify the candidate model meets fraud metrics.",
    ]
    assert {event.payload.get("agent") for event in store.list_events(run.id) if event.type == "node_end"} == {
        "MLBuilder",
        "Verifier",
    }
    assert {artifact.kind for artifact in store.list_artifacts(run.id)} >= {"code", "report", "model"}


def test_runner_fails_when_real_llm_never_returns_actionable_execution_json() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Train a fraud detection model", autonomy="autonomous"))
    spec = store.save_loop_spec(
        LoopPlanner(SequenceLLM([spec_json("MLBuilder")]))
        .generate_spec(goal)
        .model_copy(update={"status": "approved", "gates": []})
    )
    llm = SequenceLLM(["I will train the model now.", "Still not JSON."])

    run = LoopRunner(store=store, llm=llm, sandbox=RecordingSandbox(), tools=default_tool_registry()).start(goal, spec)

    assert run.status == "failed"
    assert run.result_summary == "LLM did not return actionable execution JSON."
    assert store.list_artifacts(run.id) == []
    assert [event.type for event in store.list_events(run.id)][-1] == "run_status"
