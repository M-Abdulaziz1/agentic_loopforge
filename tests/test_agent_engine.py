from __future__ import annotations

from types import SimpleNamespace

from api.loopforge.agent_engine import NativeReActEngine
from api.loopforge.agent_loop import LoopHooks
from api.loopforge.domain import GoalMode, LoopSpecAgent
from api.loopforge.opencode_config import build_opencode_config
from api.loopforge.opencode_engine import OpencodeEngine
from api.loopforge.runner import LoopRunner


def _agent() -> LoopSpecAgent:
    return LoopSpecAgent(name="analyst", role="analyst", system_prompt="Profile the data.", tools=[])


def _recording_hooks(steps: int = 5) -> tuple[LoopHooks, dict]:
    log: dict = {"steps": steps, "events": [], "llm_calls": []}

    def consume_step() -> bool:
        if log["steps"] <= 0:
            return False
        log["steps"] -= 1
        return True

    hooks = LoopHooks(
        consume_step=consume_step,
        count_llm_call=lambda tokens: log["llm_calls"].append(tokens),
        emit=lambda t, m, p: log["events"].append((t, p)),
        on_code_run=lambda code, outcome: None,
    )
    return hooks, log


class _FakeSession:
    def __init__(self, *, chat_result, transcript, raise_on_create=False, raise_on_chat=False):
        self._chat_result = chat_result
        self._transcript = transcript
        self._raise_on_create = raise_on_create
        self._raise_on_chat = raise_on_chat
        self.chat_kwargs: dict | None = None
        self.aborted = False

    def create(self):
        if self._raise_on_create:
            raise RuntimeError("connection refused")
        return SimpleNamespace(id="sess_1")

    def chat(self, session_id, **kwargs):
        self.chat_kwargs = {"session_id": session_id, **kwargs}
        if self._raise_on_chat:
            raise RuntimeError("chat failed")
        return self._chat_result

    def messages(self, session_id):
        return self._transcript

    def abort(self, session_id):
        self.aborted = True


class _FakeClient:
    def __init__(self, session: _FakeSession):
        self.session = session


def _engine(session: _FakeSession, mode: GoalMode = GoalMode.OFFLINE_LOCAL) -> OpencodeEngine:
    return OpencodeEngine(
        client_factory=lambda: _FakeClient(session),
        provider_id="anthropic",
        model_id="claude-sonnet-4-6",
        mode=mode,
    )


# ---- opencode config lockdown -------------------------------------------------

def test_offline_config_hard_denies_network_and_external():
    cfg = build_opencode_config(provider_id="anthropic", model_id="m", mode=GoalMode.OFFLINE_LOCAL)
    perm = cfg["permission"]
    assert perm["webfetch"] == "deny"
    assert perm["websearch"] == "deny"
    assert perm["external_directory"] == "deny"
    assert cfg["model"] == "anthropic/m"


def test_online_config_gates_network_via_ask():
    cfg = build_opencode_config(provider_id="openai", model_id="m", mode=GoalMode.ONLINE_ENABLED)
    assert cfg["permission"]["webfetch"] == "ask"
    assert cfg["permission"]["websearch"] == "ask"


def test_config_registers_readonly_db_mcp_when_url_given():
    cfg = build_opencode_config(
        provider_id="a", model_id="m", mode=GoalMode.OFFLINE_LOCAL, mcp_db_url="http://mcp:9000"
    )
    assert cfg["mcp"]["loopforge_db"]["url"] == "http://mcp:9000"


# ---- opencode engine ----------------------------------------------------------

def test_opencode_engine_runs_and_maps_transcript():
    transcript = [
        SimpleNamespace(
            parts=[
                SimpleNamespace(type="tool", tool="bash", state="done"),
                SimpleNamespace(type="text", text="Validated report.", synthetic=False),
            ]
        )
    ]
    chat_result = SimpleNamespace(tokens={"input": 100, "output": 50}, error=None, summary="")
    session = _FakeSession(chat_result=chat_result, transcript=transcript)
    hooks, log = _recording_hooks()

    result = _engine(session).run(
        _agent(),
        goal_text="find churn drivers",
        success_criteria=["p<0.05"],
        dataset_note="dataset at /workspace/data/x.csv",
        prior_note="",
        session=object(),  # unused by the driver
        hooks=hooks,
        max_turns=10,
    )

    assert result.finished is True
    assert result.failure is None
    assert result.ran_code is True
    assert result.summary == "Validated report."
    assert log["llm_calls"] == [150]
    kinds = [t for t, _ in log["events"]]
    assert "llm_call" in kinds and "tool_call" in kinds
    # guardrail preamble + offline tool policy reached opencode
    assert session.chat_kwargs["tools"] == {"webfetch": False, "websearch": False}
    assert "no general internet" in session.chat_kwargs["system"].lower()


def test_opencode_engine_surfaces_unreachable_server_as_failure():
    session = _FakeSession(chat_result=None, transcript=[], raise_on_create=True)
    hooks, _ = _recording_hooks()
    result = _engine(session).run(
        _agent(),
        goal_text="g",
        success_criteria=[],
        dataset_note="",
        prior_note="",
        session=object(),
        hooks=hooks,
        max_turns=5,
    )
    assert result.finished is False
    assert result.failure is not None
    assert "opencode" in result.failure


def test_opencode_engine_aborts_session_on_chat_failure():
    session = _FakeSession(chat_result=None, transcript=[], raise_on_chat=True)
    hooks, _ = _recording_hooks()
    result = _engine(session).run(
        _agent(),
        goal_text="g",
        success_criteria=[],
        dataset_note="",
        prior_note="",
        session=object(),
        hooks=hooks,
        max_turns=5,
    )
    assert result.failure is not None
    assert session.aborted is True


def test_opencode_engine_respects_budget():
    session = _FakeSession(chat_result=SimpleNamespace(tokens=0, error=None, summary=""), transcript=[])
    hooks, _ = _recording_hooks(steps=0)  # no budget left
    result = _engine(session).run(
        _agent(),
        goal_text="g",
        success_criteria=[],
        dataset_note="",
        prior_note="",
        session=object(),
        hooks=hooks,
        max_turns=5,
    )
    assert result.budget_exhausted is True
    assert result.finished is False


# ---- engine selection ---------------------------------------------------------

def test_runner_defaults_to_native_engine():
    runner = LoopRunner(store=object(), llm=object(), sandbox=object(), tools=object())
    assert isinstance(runner.agent_engine, NativeReActEngine)


def test_runtime_factory_selects_engine_by_settings():
    from api.loopforge.runtime import create_agent_engine
    from api.loopforge.settings import AgentEngineMode, Settings

    goal = SimpleNamespace(mode=GoalMode.OFFLINE_LOCAL)
    native = create_agent_engine(Settings(), llm=object(), goal=goal)
    assert isinstance(native, NativeReActEngine)

    opencode = create_agent_engine(
        Settings(agent_engine=AgentEngineMode.OPENCODE), llm=object(), goal=goal
    )
    assert isinstance(opencode, OpencodeEngine)
