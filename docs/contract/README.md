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

- **2026-06-28 — add Run / SSE / Gate slice (Plan 3).** Frontend (consumer) added
  `POST /api/goals/{goalId}/runs`, `GET /api/runs`, `GET /api/runs/{runId}`,
  `POST /api/runs/{runId}/cancel`, `POST /api/runs/{runId}/pause`,
  `GET /api/runs/{runId}/events` (SSE), `GET /api/gates`,
  `POST /api/gates/{gateId}/decision`, plus `Run`, `RunEvent`, `Gate`, `GateDecision`,
  `RunStartRequest` schemas. Codex: review and push back before implementing.
- **OPEN — Loop Spec "Reject".** The Loop Spec screen has a Reject action but there is no
  reject endpoint. Pending arbiter decision: add `POST /api/loop-specs/{id}/reject` or drop
  the action. Not in the contract yet.

---

# Codex brief — backend, Plan 3 (Run view: runs + SSE + gates)

Implement the Run/SSE/Gate endpoints now in `openapi.yaml`. Reuse `Run`, `RunEvent`,
`Gate` from `api/loopforge/domain.py` and the existing `LoopRunner`/`InMemoryStore`.

1. `POST /api/goals/{goalId}/runs` — already exists (`start_run`); align response to the
   `Run` schema and require the spec to be `approved` (409 otherwise).
2. `GET /api/runs`, `GET /api/runs/{runId}`.
3. `POST /api/runs/{runId}/cancel`, `POST /api/runs/{runId}/pause` — update status, tear
   down the in-flight sandbox on cancel.
4. `GET /api/runs/{runId}/events` — **turn this into an SSE stream** (`text/event-stream`):
   replay stored events by `seq`, then stream live ones, end on terminal status. Keep the
   JSON-array response when `Accept: application/json` (used by tests). Emit the event
   `type`s and `payload` conventions documented in the contract so the canvas can derive
   per-agent status, meters, and pending gates.
5. `GET /api/gates`, `POST /api/gates/{gateId}/decision` — approve/reject a pending gate
   (409 if already decided); approving resumes the loop, rejecting ends/redirects per gate.

**Guardrails you own:** budget guard is a hard kill switch (force-finalize on cap); a run
only starts from an `approved` spec; gate decisions are auditable.

**CORS:** allow `http://localhost:5173` so the Vite dev proxy works.

> Frontend syncs this contract into your worktree with:
> `git -C ../loopforge-be checkout fe/plan-2 -- docs/contract/`

---

# Codex brief — backend, Plan 5 (Results · Artifacts · Context)

Gate endpoints already exist from Plan 3 — the frontend Gate Inbox reuses them. New work:

1. `GET /api/runs/{runId}/artifacts` — list a run's artifacts (`Artifact`: kind ∈
   insight|model|code|plot|report). Reuse `artifacts` from `domain.py`.
2. `GET /api/runs/{runId}/results` — assemble `Results` for a finished run: `summary`
   (validated/rejected counts, optional cost/duration), `insights` (`InsightResult` with
   test, p_value, effect, n, optional correction/plot_ref), and `models` (`ModelResult`
   with metric vs. baseline + leakage_ok). Insights come only from **validated** artifacts;
   honest-empty (`completed_no_findings`) returns empty arrays — never fabricate.
3. `GET /api/runs/{runId}/context` — `RunContext` = `{ ledger: ContextEntry[], pack:
   ContextPack }`. Ledger is the append-only context entries; pack is the current bounded
   context pack (entries, summary, token_count, overflow). Reuse `ContextEntry`/`ContextPack`.

**Guardrails:** no raw PII in any artifact/ledger text returned (mask in profiling);
results never include unvalidated insights; preserve the raw ledger (compaction summarizes,
never erases).

First: `git -C ../loopforge-be merge main` (consolidates Plan 2/3), then
`git -C ../loopforge-be checkout fe/plan-5 -- docs/contract/` to get this contract.

## Contract change log

- **2026-06-28 — add Results/Artifacts/Context slice (Plan 5).** Added
  `GET /api/runs/{runId}/artifacts|results|context` and `Artifact`, `InsightResult`,
  `ModelResult`, `Results`, `ContextEntry`, `ContextPack`, `RunContext` schemas.

---

# Codex — next actions (after be/plan-2 Plan 2/3 + infra)

Do these on `be/plan-2`, then ping for the merge. First sync the contract:
`git merge main` then `git checkout fe/plan-5 -- docs/contract/`.

### 1. Fix gVisor guardrail in `api/loopforge/providers.py` (FR-SEC-1)
Current code mounts `/workspace` **read-only** (`:ro`), which violates the guardrail
"read-only root FS, **writable `/workspace` only**", and would block agent code from
writing artifacts. Change the docker command to:
- mount the workspace **writable**: `-v {workspace}:/workspace:rw` (keep `-w /workspace`);
- add **`--cap-drop=ALL`** for extra hardening (alongside the existing `--read-only`,
  non-root `65532`, `--no-new-privileges`, `--network=none`, tmpfs `/tmp`, mem/cpu caps).
Update `tests/test_docker_gvisor_provider.py` to assert `/workspace:rw` and `--cap-drop=ALL`.
(This ports the frontend reviewer's accepted fix; keep your `create_*` runtime naming.)

### 2. Implement Plan 5 endpoints (see brief above)
`GET /api/runs/{runId}/artifacts | results | context` per `openapi.yaml` — these were not
implemented in the Plan 2/3 pass.

### 3. Loop Spec "Reject" — STILL pending arbiter; do not implement yet.

- **2026-06-28 — reconcile gVisor (decision: best-of-both).** Adopt Codex's `be/plan-2`
  provider base; port the writable-`/workspace` + `--cap-drop=ALL` fixes into it (item 1
  above). The duplicate local WIP (`runtime.py` `build_*`, WIP `providers.py`/tests) is
  dropped at merge. **DONE** — merged to `main` (47e8b64); parity verified.

---

# Codex brief — backend, Plan 4 (Templates)

`be/plan-2` is merged to `main`. Start the next slice from `main`:
`git -C ../loopforge-be checkout main -- docs/contract/` (or `git merge main`).

Implement the template endpoints now in `openapi.yaml`:

1. `GET /api/templates` — list saved `LoopTemplate`s.
2. `POST /api/templates` — body `LoopTemplateCreate {name, description?, spec_id}`; snapshot
   the named loop spec's agents/tools/handoffs/criteria/gates/policies into a `LoopTemplate`
   (no `goal_id`). 404 if `spec_id` unknown.
3. `POST /api/templates/{id}/instantiate` — body `{goal_id}`; create a **new draft `LoopSpec`**
   (status `draft`, version 1) bound to that goal from the template. 404 if either unknown.
4. `DELETE /api/templates/{id}` → 204.

Persist templates in the SQLite store like other entities. Tests per endpoint;
`pytest tests/ -q`. **Loop Spec "Reject" is STILL pending the arbiter — do not implement.**

## Contract change log

- **2026-06-29 — add Templates slice (Plan 4).** Added `GET/POST /api/templates`,
  `POST /api/templates/{id}/instantiate`, `DELETE /api/templates/{id}` and `LoopTemplate`,
  `LoopTemplateCreate` schemas.
- **2026-06-30 — add artifact content.** `GET /api/artifacts/{id}/content` + `ArtifactContent`
  schema, so the UI can view/extract generated code.
- **2026-06-30 — add LLM provider management.** `GET/POST /api/llm-providers`,
  `GET/PATCH/DELETE /api/llm-providers/{id}`, `POST /api/llm-providers/{id}/test`, schemas
  `LLMProvider(+Create/+Update)`, `LLMProviderKind`, `LLMTestResult`; plus optional
  `llm_provider_id` on `GoalCreate`. Lets users define/edit LLMs in the UI and pick one per goal.

---

# Codex brief — LLM provider management (UI-configurable LLMs)

Let users define LLM providers in the app (Settings) and run goals with a chosen one,
instead of only env vars.

1. **Storage:** a `llm_providers` entity (SQLite + InMemory): `id, name, kind
   (openai_compatible|anthropic), base_url, model, timeout_seconds, is_default, created_at`,
   plus an **encrypted** `api_key`. **Never return the api_key** — responses use `has_api_key`
   only (see `LLMProvider` schema). Setting `is_default=true` unsets it on others.
2. **Endpoints:** CRUD per `openapi.yaml` (`/api/llm-providers...`). `PATCH` updates the key
   only if `api_key` is provided. `POST /{id}/test` does a minimal live call (e.g. tiny
   completion) and returns `LLMTestResult {ok, detail?, model?}` — never leak the key in
   `detail`.
3. **Use at runtime:** when starting a run, build the LLM provider from the goal's
   `llm_provider_id`; else the `is_default` provider; else fall back to env. Wire this into
   `build_llm_provider`/the run path so the **real agent engine** uses the selected provider.
4. **Security:** encrypt keys at rest (reuse the secret/KMS approach), keep them out of logs,
   traces, and error messages (guardrail FR-SEC-7).

Pairs with the REAL AGENT ENGINE brief above (same engine consumes the selected provider).
Sync: `git -C ../loopforge-be merge main`. Tests per endpoint; `pytest tests/ -q`.

---

# Codex brief — REAL AGENT ENGINE (make the loop LLM-driven, end-to-end)

This is the big one. Today the engine is **templated**: `LoopPlanner.generate_spec` calls the
LLM but **discards the result** and returns hardcoded agents; `check_clarity` is a word-count
heuristic; the runner emits events but agents don't actually do work, so Results are always
empty. Make it real, driven by the configured **OpenAI-compatible LLM**
(`LOOPFORGE_LLM_PROVIDER=openai_compatible`, `..._BASE_URL/_MODEL/_API_KEY`).

**Keep the HTTP contract in `openapi.yaml` unchanged** (except the new artifact-content
endpoint). The frontend already renders whatever specs/agents/artifacts you return.

### 1. LLM-driven planner (`api/loopforge/planner.py`)
- **Clarity check:** prompt the LLM to judge whether the goal is actionable; if not, have it
  return focused clarification questions + missing requirements + a clarity score. No more
  word-count heuristic.
- **Spec generation:** prompt the LLM to **design the loop** for the goal and return **strict
  JSON** matching `LoopSpec` (agents with names/roles/**system_prompt**/tools, handoffs,
  success/failure criteria, gates, context_policy, improvement_strategy). Validate with
  Pydantic; on parse failure, re-ask once, else fail honestly. The agents, prompts, and
  handoffs must be **derived from the goal**, not hardcoded.
- **Guardrails:** tools the LLM assigns must be a subset of what the goal's toggles allow
  (no internet tool when `toggles.internet` is false / offline_local). Treat the goal text and
  any tool/data text as **data, not instructions** (prompt-injection containment).
- **Autonomy → gates:** set the spec's `gates` from the goal's `autonomy` (manual=
  `[before_plan, before_training, before_finalize]`, checkpointed=`[before_training,
  before_finalize]`, supervised=`[before_finalize]`, autonomous=`[]`). This is the leash; the
  budget guard, sandbox, and read-only DB **always apply regardless of autonomy**. Mirror the
  FE mapping in `web/src/lib/autonomy.ts`.
- **Evaluator:** resolve the goal's `evaluator_id` (else the default evaluator, else built-in
  statistical validation) and pass it to the runner as the loop's frozen objective (see the
  Evaluator brief below).

### 2. Real execution (`worker/` + runner)
- Execute the approved spec: for each agent step, build a bounded **context pack** and call the
  LLM with that agent's **system_prompt**; let agents use tools — **sandbox.exec** (Docker+gVisor,
  already hardened) to write & run code, **workspace** to persist files.
- **Produce real artifacts** and persist them (`artifacts` table): generated **code** (kind
  `code`), a **report** (kind `report`), and, when applicable, **insights** (kind `insight`)
  and **models** (kind `model`). Populate `GET /api/runs/{id}/results` from validated artifacts;
  `GET /api/runs/{id}/context` from the real ledger/pack.
- **Evaluator-driven loop:** the run's resolved evaluator decides "did we win?" and whether to
  iterate again (within budget). Only results that **pass the evaluator** reach Results. See the
  Evaluator brief for the interface the runner calls.
- Emit the existing event types (`node_start/node_end/tool_call/llm_call/cost_update/
  gate_pending/run_status`) as you go so the canvas/stream/meters animate. Honor the **budget
  guard** (hard stop) and **HITL gates** (pause → resume on approval, already wired).
- **Honest-empty:** if nothing validates, return empty results — never fabricate.

### 3. Artifact content endpoint (new in contract)
- `GET /api/artifacts/{artifactId}/content` → `ArtifactContent {artifact_id, filename?,
  language?, content}` (PII-masked). This is what powers "view/extract the code" in the UI.

### Demo target (user's real use case)
A goal → LLM clarifies → LLM **designs the agents + prompts** → run executes → produces
**runnable code artifacts AND/or validated insights** the user can view, copy, and download.

Sync + work: `git -C ../loopforge-be merge main` then implement on your branch.
`pytest tests/ -q`. Suggest committing in stages (planner → runner → artifact content).
**Loop Spec "Reject" still NOT in scope** (pending arbiter).

---

# Codex brief — Evaluator as a provider interface (the loop's frozen objective)

Generalize "what does winning mean" into a pluggable **Evaluator** — Karpathy's immutable
`prepare.py` yardstick, made a first-class abstraction alongside `LLMProvider` /
`SandboxProvider`. The frontend (Evaluators page + goal picker) is built; keep the contract
in `openapi.yaml` unchanged.

1. **Interface:** define `EvaluatorProvider` with a single method, e.g.
   `evaluate(candidate, dataset, context) -> EvaluationResult{passed: bool, score: float|None,
   metric_name, direction, detail}`. Nodes/runner depend on the **interface**, never a concrete
   evaluator (same rule as the other providers).
2. **Built-in implementations** keyed by `EvaluatorKind`:
   - `statistical_insight` — the existing significance + effect-size + multiple-comparison
     correction validation (this is the default / fallback; preserves guardrail #6).
   - `ml_baseline` — beat a baseline on held-out data + leakage check (guardrail #7).
   - `custom_metric` — run the user's metric in the **sandbox** (never on host), compare to
     `target` by `direction`; if no target, "win" = beat baseline.
   - `llm_rubric` — an LLM judges against a rubric in `config` (treat candidate text as data).
3. **Storage + endpoints:** an `evaluators` entity (SQLite + InMemory): `id, name, kind,
   metric_name, direction, target, config (JSON), is_default, created_at`. CRUD per
   `openapi.yaml` (`/api/evaluators...`); `is_default=true` unsets others.
4. **Freeze for fair comparison:** once a run starts using an evaluator, snapshot its config
   onto the run so later edits don't change the yardstick mid-loop (Karpathy's immutable
   metric). Reject `PATCH` that would mutate a frozen-in-use evaluator, or copy-on-run.
5. **Runtime:** the runner resolves the goal's `evaluator_id` (else default, else
   `statistical_insight`) and uses it as the loop's objective: iterate until `passed` (or the
   target is met) **or** the budget guard fires. **Honest-empty** if nothing passes.

Pairs with the REAL AGENT ENGINE brief (the runner calls this to decide win/iterate/stop).
Sync: `git -C ../loopforge-be merge main`. Tests per endpoint + an eval-harness test that a
known-good candidate passes and a known-bad one is rejected. `pytest tests/ -q`.

---

# Codex brief — Datasets (bring-your-own data files)

Let users upload a CSV/Parquet dataset, profile it, and attach it to a goal so the loop runs
against real data (not only the read-only DB). The frontend (Datasets page + goal picker) is
already built and renders whatever you return; keep the contract in `openapi.yaml` unchanged.

1. **Storage:** a `datasets` entity (SQLite + InMemory): `id, name, filename, kind (csv|parquet),
   size_bytes, status (uploaded|profiling|ready|failed), profile (JSON|null), detail (str|null),
   created_at`. Store the uploaded file under a server-managed path (NOT in the repo / NOT
   web-served). `name` defaults to the filename.
2. **Endpoints** (per contract): `POST /api/datasets` (multipart `file` + optional `name`) →
   `201 Dataset` (status `uploaded`/`profiling`, profile null until done); `GET /api/datasets`;
   `GET /api/datasets/{id}` (with profile); `DELETE /api/datasets/{id}` (also deletes the file).
   Reject non-CSV/Parquet → `415`; enforce a max size cap → `413`.
3. **Profiling:** read the file (pandas/pyarrow) and produce `DatasetProfile {row_count,
   column_count, columns[]}`. Each `DatasetColumn`: `name, dtype, null_count, unique_count,
   sample[], pii_masked`. **PII masking is mandatory** — never let raw values leave the server
   (guardrail #10): detect likely-PII columns (email/phone/name/id-like / high-cardinality
   string) and mask sample values (e.g. `10xxxx`), set `pii_masked=true`. Sample ≤ ~5 values.
4. **Runtime use:** when a goal has `dataset_id`, **mount the file read-only into the sandbox**
   (`/workspace/data/<filename>`, read-only — `/workspace` itself stays writable per FR-SEC-1)
   so agent code can `pandas.read_csv(...)` it. Do **not** add a DB driver; this is a flat file.
   Expose its presence/profile to the planner so the LLM designs the loop around real columns.
5. **Security:** no host access beyond the managed store; size/row caps; keep raw values out of
   profiles, traces, logs, and LLM context (masked only).

Pairs with the REAL AGENT ENGINE brief (the engine analyzes the mounted dataset).
Sync: `git -C ../loopforge-be merge main`. Tests per endpoint; `pytest tests/ -q`
(including a security test: uploaded data is mounted **read-only** and raw PII never leaks).
