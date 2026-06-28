# LoopForge contract & two-agent protocol

Two agents build LoopForge in parallel:

- **Frontend — Claude** (`fe/plan-2`, works in `web/`)
- **Backend — Codex** (`be/plan-2`, works in `api/`, `worker/`, `mcp/`)

`docs/contract/openapi.yaml` is the **single source of truth** for the HTTP boundary.
Neither side invents, renames, or reshapes an endpoint or schema on its own.

## Ownership (do not cross without a renegotiation)

| Area | Owner |
|------|-------|
| `web/**` | Claude (frontend) |
| `api/**`, `worker/**`, `mcp/**`, Alembic migrations | Codex (backend) |
| `docs/contract/openapi.yaml` | **Shared** — changes only via the renegotiation step below |

## The conflict / reconcile loop

1. **Negotiate the contract.** Claude drafts `openapi.yaml` as the *consumer*. Codex
   reviews as the *implementer* and pushes back (feasibility, naming, cost, status codes).
   Disagreements go to the human (arbiter). When both agree, the contract is **frozen**.
2. **Build independently** against the frozen contract. Frontend mocks responses with MSW
   that conform to the contract; backend implements FastAPI routes that conform to it.
3. **Integrate.** Frontend points at the real backend (`VITE_API_BASE=http://localhost:8000`).
   A contract/parity check surfaces every divergence as a hard failure.
4. **Cross-review.** Claude reviews backend responses for contract adherence; Codex reviews
   the frontend's request usage. Each files objections; the human arbitrates ties.

### Renegotiating the contract

If either side needs a contract change: open a short note in this file under
`## Contract change log`, state the change + why, get the other side's ack (human relays),
then edit `openapi.yaml` in a single commit titled `contract: <change>`. Both sides rebase.

## Definition of done per endpoint

- Matches `openapi.yaml` exactly (path, method, request, response, status codes).
- Has a test asserting the success shape and the documented error cases.
- Guardrails enforced server-side (see below) — never trusted from the client.

---

# Codex brief — backend, Plan 2 (Goal → Clarify → Loop Spec)

**You are Codex, the backend implementer.** Implement the endpoints in
`docs/contract/openapi.yaml` for the Goal → Clarification → Loop Spec slice.

## Workspace

You are in the git worktree `../loopforge-be` on branch `be/plan-2`. Only touch
`api/`, `worker/`, `mcp/`, `tests/`. Do **not** touch `web/`. The Python env: this repo
uses `pyproject.toml`; create/activate a venv in this worktree (`python -m venv .venv &&
. .venv/bin/activate && pip install -e ".[dev]"`) or use the existing tooling.

## What exists already (reuse, don't duplicate)

- `api/loopforge/domain.py` — Pydantic models (`Goal`, `GoalCreate`, `GoalToggles`,
  `Budget`, `ClarificationSession`, `ClarificationQuestion`, `LoopSpec`, `LoopSpecAgent`,
  `ToolPermission`, `RunStatus`, …). The contract schemas mirror these — extend these
  models if a field is missing rather than creating parallel types.
- `api/loopforge/app.py` — FastAPI app with `POST /api/goals`,
  `POST /api/loop-specs/{id}/approve`, etc. Currently an in-memory `InMemoryStore` and
  `FakeLLMProvider`/`FakeSandboxProvider`.
- `api/loopforge/planner.py` — `LoopPlanner` (clarity check, spec generation).
- `api/loopforge/store.py` — `InMemoryStore`.

## Endpoints to implement / complete (per contract)

1. `GET  /api/goals` — list, newest first.
2. `POST /api/goals` — already exists; align its response to `GoalCreateResult`
   (`{goal, clarification?, loop_spec?}`) and add `status: open|ready` to sessions.
3. `GET  /api/goals/{goalId}`.
4. `GET  /api/goals/{goalId}/clarification`.
5. `POST /api/goals/{goalId}/clarification/answers` — accept `{question_id, answer}`,
   update the session, recompute `clarity_score`/`missing_requirements`; when sufficient,
   generate the spec and return it in `loop_spec` with session `status="ready"`.
6. `GET  /api/loop-specs?goal_id=` and `GET /api/loop-specs/{specId}`.
7. `PATCH /api/loop-specs/{specId}` — apply partial edits → bump `version`. **Must**
   re-run graph validation and **must reject** tool permissions that violate the goal's
   capability toggles.
8. `POST /api/loop-specs/{specId}/approve` — already exists; ensure it returns the spec and
   409s if not `draft`.

## Guardrails you own (enforce server-side, never trust the client)

- A goal in `offline_local` mode can never get an agent/tool with internet access. Reject
  `PATCH` that tries to enable an internet tool when `toggles.internet` is false →
  `422 { detail }`.
- No silent capability escalation: tool permissions in a spec must be a subset of what the
  goal's toggles allow.
- Honest statuses: use `needs_clarification`, `unsafe_request`, etc. as in the contract.

## Conventions

Python 3.12, FastAPI, Pydantic v2, type hints everywhere, `ruff` + `black`, `pytest`.
Each endpoint ships a test. Run `pytest tests/ -q` (and `pytest tests/security -q` if
present) before committing. Commit messages reference FR IDs, e.g.
`feat(api): clarification answers endpoint [FR-RUN]`.

## Run the API for integration

`uvicorn api.loopforge.app:app --reload --port 8000` — the frontend will hit
`http://localhost:8000`. CORS must allow `http://localhost:5173` (Vite dev).

## Contract change log

(empty — append entries here when renegotiating)
