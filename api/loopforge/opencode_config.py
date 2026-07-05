"""Generate the locked-down ``opencode.json`` that runs inside the sandbox.

opencode defaults to broad access (bash, file edit, webfetch/websearch, its own
permission prompts). LoopForge's guardrails require the opposite: no general
internet, DB only via the read-only MCP server, edits confined to the workspace.
This module renders a config that pins the model/provider and denies everything
the guardrails forbid, so even before the container's ``network=none`` isolation,
opencode itself refuses off-policy actions.
"""
from __future__ import annotations

import json
from pathlib import Path

from api.loopforge.domain import GoalMode

# Tools whose network egress the guardrails forbid outright in offline mode.
_NETWORK_TOOLS = ("webfetch", "websearch")


def build_opencode_config(
    *,
    provider_id: str,
    model_id: str,
    mode: GoalMode,
    mcp_db_url: str | None = None,
) -> dict:
    """Render the opencode config dict for one run.

    - ``permission`` denies network tools and out-of-workspace edits. In OFFLINE
      mode network tools are hard-denied; in ONLINE mode they are ``ask`` so each
      request surfaces as a LoopForge HITL gate (never silent open-internet).
    - ``model`` pins the provider/model LoopForge selected.
    - the read-only DB MCP server is the only configured data egress.
    """
    online = mode == GoalMode.ONLINE_ENABLED
    network_rule = "ask" if online else "deny"

    permission: dict[str, object] = {
        "*": "ask",
        # bash/edit/read/write operate on the sandboxed workspace only.
        "bash": "allow",
        "edit": {"*": "deny", "**": "allow"},  # within the project (cwd=/workspace) only
        "read": "allow",
        "external_directory": "deny",  # never touch paths outside /workspace
    }
    for tool in _NETWORK_TOOLS:
        permission[tool] = network_rule

    config: dict[str, object] = {
        "$schema": "https://opencode.ai/config.json",
        "model": f"{provider_id}/{model_id}",
        "permission": permission,
    }
    if mcp_db_url:
        # The read-only Postgres MCP server — the agent's only route to the data.
        config["mcp"] = {
            "loopforge_db": {
                "type": "remote",
                "url": mcp_db_url,
                "enabled": True,
            }
        }
    return config


def write_opencode_config(workspace: Path, config: dict) -> Path:
    """Write ``opencode.json`` into the run workspace; return its path."""
    target = Path(workspace) / "opencode.json"
    target.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return target
