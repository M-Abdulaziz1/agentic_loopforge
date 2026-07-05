# LoopForge native sandbox image (native_react engine).
#
# This is the image agent-generated code runs in when LOOPFORGE_AGENT_ENGINE=native_react
# (the default). It pre-carries the data-science package allowlist so the agent can
# profile/model inside the container WITHOUT an open `pip install` and WITHOUT general
# internet (guardrail #2). The agent cannot install packages itself by design — the
# approved libraries must already be present in the image.
#
# LoopForge runs this container non-root, read-only root FS, gVisor runtime, writable
# /workspace only — those flags are added at run time, not baked here.
#
# Build:  docker build -f docker/sandbox.Dockerfile -t loopforge/sandbox:latest .
# Then point the sandbox at it:  LOOPFORGE_DOCKER_SANDBOX_IMAGE=loopforge/sandbox:latest
FROM python:3.12-slim

# --- data-science allowlist (identical to the opencode sandbox image) ----------
# Only these packages are approved (guardrail #2). Keep this list in sync with the
# native ReAct system prompt and docker/opencode-sandbox.Dockerfile.
RUN pip install --no-cache-dir \
      pandas numpy scipy scikit-learn statsmodels xgboost lightgbm matplotlib seaborn

WORKDIR /workspace
