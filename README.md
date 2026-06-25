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

The first implementation uses deterministic fake providers. Follow-up implementation plans replace those providers with durable storage, a worker, Docker plus gVisor sandbox execution, and local OpenAI-compatible LLM calls.
