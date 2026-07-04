# Running planner agents on the opencode engine

LoopForge can drive each planner-generated agent with **opencode** instead of its
built-in ReAct loop. LoopForge stays the orchestrator and gatekeeper — budget,
HITL gates, evaluators, and the guardrails are unchanged — while opencode does the
reason→act→observe work inside the sandbox.

## How it fits the guardrails

- **Guardrail #1 (never run agent code on the host):** `opencode serve` runs
  *inside* a hardened gVisor container (non-root, read-only root FS, writable
  `/workspace` + tmpfs only). LoopForge launches it per run via
  `SandboxProvider.serve_opencode(...)` and tears it down when the turn ends.
- **Guardrail #2 (no general internet):** the rendered `opencode.json` hard-denies
  `webfetch`/`websearch` and `external_directory` in offline mode; online mode
  turns them into `ask` (→ a LoopForge HITL gate). The serve container needs a
  reachable API port so it cannot use `network=none`; it MUST run on an
  egress-allowlist network (`LOOPFORGE_DOCKER_OPENCODE_NETWORK`) that reaches only
  the model endpoint and the read-only DB — never the open default bridge.
- **Guardrail #3 (read-only DB):** data reaches the agent only via the read-only
  MCP server, registered in `opencode.json` when a URL is configured.
- **Guardrail #4 (budget):** the engine consumes a step before launching and
  records token usage; no path skips the budget guard.
- **Guardrail #5/#6 (validation + honest empty):** opencode's transcript is mapped
  back into LoopForge's evaluators/gates; an unreachable or failing server surfaces
  an honest error, never a fabricated result.

## One-time setup

1. Build the sandbox image (opencode binary + DS allowlist):

   ```bash
   docker build -f docker/opencode-sandbox.Dockerfile -t loopforge/opencode-sandbox:latest .
   ```

2. Create the egress-allowlist network (reaches the model endpoint + DB only):

   ```bash
   docker network create --internal loopforge-egress
   # then add the allowlist routes your deployment needs (model API, MCP DB)
   ```

3. Install the optional SDK and select the engine:

   ```bash
   pip install -e .[opencode]
   ```

   ```dotenv
   LOOPFORGE_AGENT_ENGINE=opencode
   LOOPFORGE_OPENCODE_PROVIDER_ID=openai        # or anthropic, etc.
   LOOPFORGE_OPENCODE_MODEL_ID=claude-sonnet-4-6
   LOOPFORGE_DOCKER_OPENCODE_IMAGE=loopforge/opencode-sandbox:latest
   LOOPFORGE_DOCKER_OPENCODE_NETWORK=loopforge-egress
   ```

   The model API key comes from `LOOPFORGE_OPENAI_COMPATIBLE_API_KEY` (injected into
   the container as `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`), never hard-coded.

Approve a loop spec and start a run as usual — each agent now runs on opencode.

## Seams (for maintainers)

- `opencode_config.py` — renders the locked-down `opencode.json`.
- `providers.py:DockerGvisorSandboxProvider.serve_opencode` — launches/stops the
  in-sandbox server (unit-testable via injected `command_runner` + `readiness_probe`).
- `opencode_engine.py:OpencodeEngine` — opens a session, sends the goal, maps the
  transcript to run events, always stops the server in a `finally`.
- `runtime.py:create_agent_engine` — wires the launcher from the sandbox provider.
