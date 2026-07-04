from __future__ import annotations

import subprocess
from types import SimpleNamespace

from api.loopforge.agent_engine import NativeReActEngine
from api.loopforge.agent_loop import LoopHooks
from api.loopforge.domain import GoalMode, LoopSpecAgent
from api.loopforge.opencode_config import build_opencode_config
from api.loopforge.opencode_engine import OpencodeEngine
from api.loopforge.providers import DatasetMount, DockerGvisorSandboxProvider, OpencodeServerHandle, SandboxSession
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


# ---- in-sandbox opencode serve launcher --------------------------------------

def _fake_docker(records: list, *, container_id="oc123", run_rc=0, run_stderr=""):
    def runner(command, timeout):
        records.append(command)
        if command[:2] == ["docker", "run"]:
            return subprocess.CompletedProcess(command, run_rc, stdout=f"{container_id}\n", stderr=run_stderr)
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    return runner


def test_serve_opencode_launches_hardened_container_and_returns_handle(tmp_path):
    records: list = []
    provider = DockerGvisorSandboxProvider(
        runtime="runsc",
        opencode_image="loopforge/opencode-sandbox:latest",
        opencode_network="loopforge-egress",
        command_runner=_fake_docker(records),
        readiness_probe=lambda url: True,  # pretend the server answered
    )
    workspace = tmp_path / "ws"
    (workspace / "data").mkdir(parents=True)
    session = SandboxSession(
        workspace=workspace,
        exec_python=lambda ws, code, t: None,
        dataset_mount=DatasetMount(host_path=tmp_path / "churn.csv", filename="churn.csv"),
    )
    cfg = build_opencode_config(provider_id="openai", model_id="m", mode=GoalMode.OFFLINE_LOCAL)

    handle = provider.serve_opencode(session, config=cfg, env={"OPENAI_API_KEY": "k"})

    assert isinstance(handle, OpencodeServerHandle)
    assert handle.base_url.startswith("http://127.0.0.1:")
    # opencode.json was written into the run workspace
    assert (workspace / "opencode.json").exists()
    run_cmd = records[0]
    assert run_cmd[:3] == ["docker", "run", "-d"]
    assert "--runtime=runsc" in run_cmd
    assert "--network=loopforge-egress" in run_cmd  # NOT the open default bridge
    assert "--read-only" in run_cmd
    assert "65532:65532" in run_cmd
    assert "loopforge/opencode-sandbox:latest" in run_cmd
    assert "serve" in run_cmd
    # read-only dataset mounted into the serve container
    assert any("/workspace/data/churn.csv:ro" in part for part in run_cmd)
    # publish only to host loopback
    assert any(part.startswith("127.0.0.1:") and part.endswith(":4096") for part in run_cmd)

    handle.stop()
    assert records[-1][:3] == ["docker", "rm", "-f"]


def test_serve_opencode_surfaces_readiness_timeout_and_cleans_up(tmp_path):
    records: list = []
    provider = DockerGvisorSandboxProvider(
        command_runner=_fake_docker(records),
        readiness_probe=lambda url: False,  # never becomes ready
        opencode_startup_timeout_seconds=0.3,
    )
    workspace = tmp_path / "ws"
    (workspace / "data").mkdir(parents=True)
    session = SandboxSession(workspace=workspace, exec_python=lambda ws, code, t: None)
    cfg = build_opencode_config(provider_id="openai", model_id="m", mode=GoalMode.OFFLINE_LOCAL)

    import pytest

    with pytest.raises(Exception) as exc:
        provider.serve_opencode(session, config=cfg)
    assert "ready" in str(exc.value).lower()
    # container was force-removed on the failure path
    assert any(cmd[:3] == ["docker", "rm", "-f"] for cmd in records)


def test_opencode_engine_launches_and_stops_in_sandbox_server():
    transcript = [SimpleNamespace(parts=[SimpleNamespace(type="text", text="Report.", synthetic=False)])]
    chat_result = SimpleNamespace(tokens={"input": 10, "output": 5}, error=None, summary="")
    oc_session = _FakeSession(chat_result=chat_result, transcript=transcript)

    stopped = {"count": 0}
    launched = {"count": 0}

    def launcher(session):
        launched["count"] += 1
        return OpencodeServerHandle(
            base_url="http://127.0.0.1:55055",
            container_id="oc1",
            _stop=lambda: stopped.__setitem__("count", stopped["count"] + 1),
        )

    engine = OpencodeEngine(
        provider_id="openai",
        model_id="m",
        mode=GoalMode.OFFLINE_LOCAL,
        server_launcher=launcher,
        client_from_url=lambda url: _FakeClient(oc_session),
    )
    hooks, log = _recording_hooks()

    result = engine.run(
        _agent(),
        goal_text="g",
        success_criteria=[],
        dataset_note="",
        prior_note="",
        session=object(),
        hooks=hooks,
        max_turns=5,
    )

    assert result.finished is True
    assert launched["count"] == 1
    assert stopped["count"] == 1  # server always torn down
    assert any(t == "tool_call" for t, _ in log["events"])


def test_opencode_engine_stops_server_even_when_run_fails():
    session = _FakeSession(chat_result=None, transcript=[], raise_on_create=True)
    stopped = {"count": 0}

    def launcher(_session):
        return OpencodeServerHandle(
            base_url="http://127.0.0.1:1",
            container_id="oc1",
            _stop=lambda: stopped.__setitem__("count", stopped["count"] + 1),
        )

    engine = OpencodeEngine(
        provider_id="openai",
        model_id="m",
        server_launcher=launcher,
        client_from_url=lambda url: _FakeClient(session),
    )
    hooks, _ = _recording_hooks()

    result = engine.run(
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
    assert stopped["count"] == 1  # finally-block cleanup ran despite the failure


def test_opencode_engine_requires_a_client_source():
    import pytest

    with pytest.raises(ValueError):
        OpencodeEngine(provider_id="openai", model_id="m")


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
    # Without a sandbox it falls back to a pre-existing server (client_factory).
    assert opencode.server_launcher is None
    assert opencode.client_factory is not None


def test_runtime_factory_wires_in_sandbox_launcher_when_sandbox_given():
    from api.loopforge.runtime import create_agent_engine
    from api.loopforge.settings import AgentEngineMode, Settings

    goal = SimpleNamespace(mode=GoalMode.OFFLINE_LOCAL)
    launched: list = []

    class _Sandbox:
        def serve_opencode(self, session, *, config, env=None):
            launched.append((config, env))
            return OpencodeServerHandle(base_url="http://127.0.0.1:9", container_id="c", _stop=lambda: None)

    engine = create_agent_engine(
        Settings(agent_engine=AgentEngineMode.OPENCODE), llm=object(), goal=goal, sandbox=_Sandbox()
    )
    assert isinstance(engine, OpencodeEngine)
    assert engine.server_launcher is not None
    # the launcher renders the locked-down config + injects only the model env
    engine.server_launcher(object())
    config, env = launched[0]
    assert config["permission"]["webfetch"] == "deny"
    assert set(env) <= {"OPENAI_API_KEY", "OPENAI_BASE_URL"}
