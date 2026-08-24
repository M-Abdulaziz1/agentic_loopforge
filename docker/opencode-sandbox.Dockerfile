# LoopForge in-sandbox opencode image.
#
# This is the image `opencode serve` runs in when LOOPFORGE_AGENT_ENGINE=opencode.
# It carries the opencode binary PLUS the data-science package allowlist, so the
# agent can profile/model inside the container with no open `pip install` and no
# general internet (guardrail #2). The container is run non-root, read-only root
# FS, gVisor runtime, writable /workspace only — LoopForge adds those flags.
#
# Build:  docker build -f docker/opencode-sandbox.Dockerfile -t loopforge/opencode-sandbox:latest .
FROM python:3.12-slim

# --- data-science allowlist (identical to the native sandbox) -----------------
RUN pip install --no-cache-dir \
      pandas numpy scipy scikit-learn statsmodels xgboost lightgbm matplotlib seaborn

# --- opencode binary ----------------------------------------------------------
# opencode ships a standalone binary; pin a version rather than tracking latest.
ARG OPENCODE_VERSION=latest
RUN apt-get update \
      && apt-get install -y --no-install-recommends curl ca-certificates unzip \
      && curl -fsSL https://opencode.ai/install | bash -s -- "${OPENCODE_VERSION}" \
      # The installer drops the binary in /root/.opencode/bin, but the container runs
      # non-root (uid 65532) and can't traverse /root (mode 700). Move the standalone
      # binary to a world-accessible dir already on PATH so `opencode serve` starts.
      && mv /root/.opencode/bin/opencode /usr/local/bin/opencode \
      && chmod 0755 /usr/local/bin/opencode \
      && rm -rf /root/.opencode \
      && apt-get purge -y curl unzip \
      && apt-get autoremove -y \
      && rm -rf /var/lib/apt/lists/*

# LoopForge sets HOME/XDG to /workspace at run time (the sole writable mount) and
# writes the locked-down opencode.json there, so no config is baked into the image.
WORKDIR /workspace
EXPOSE 4096
