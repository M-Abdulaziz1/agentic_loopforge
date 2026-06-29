# LoopForge

LoopForge is a generic agent-loop creation and management platform. The first backend slice supports goal creation, clarity checks, generated loop specs, approval before run, deterministic run execution, permissioned tools, and bounded context packs.

## First Backend Slice

Run tests:

```bash
./.venv/bin/python -m pytest
```

Run the API locally:

```bash
./.venv/bin/python -m uvicorn api.loopforge.app:app --reload
```

By default, the importable ASGI app stores state in SQLite at `.loopforge/loopforge.db`
and uses deterministic fake LLM/sandbox providers for offline development.

Use a local or cloud OpenAI-compatible LLM endpoint:

```bash
LOOPFORGE_LLM_PROVIDER=openai_compatible
LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL=http://localhost:8000/v1
LOOPFORGE_OPENAI_COMPATIBLE_API_KEY=local-dev-key
LOOPFORGE_OPENAI_COMPATIBLE_MODEL=local-model
```

Use Docker plus gVisor for sandbox execution:

```bash
LOOPFORGE_SANDBOX_PROVIDER=docker_gvisor
LOOPFORGE_DOCKER_GVISOR_RUNTIME=runsc
LOOPFORGE_DOCKER_SANDBOX_IMAGE=python:3.12-slim
LOOPFORGE_DOCKER_NETWORK=none
```

The OpenAI-compatible provider works with cloud providers, vLLM, LM Studio,
Ollama OpenAI-compatible gateways, or internal inference servers that support
`/v1/chat/completions`.
