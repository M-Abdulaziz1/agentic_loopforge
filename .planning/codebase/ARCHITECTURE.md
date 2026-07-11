<!-- refreshed: 2026-07-11 -->
# Architecture

**Analysis Date:** 2026-07-11

## System Overview

```text
┌────────────────────────────────────────────────────────────┐
│ React operator UI                                           │
│ `web/src/pages/` + `web/src/components/`                    │
└─────────────────────────────┬──────────────────────────────┘
                             │ HTTP JSON / event polling
                             ▼
┌───────────────────────────────────────────────────────────┐
│ FastAPI application / composition root                          │
│ `api/loopforge/app.py`                                        │
└──────────────┬───────────────┬──────────────────────────────┘
               │               │
               ▼               ▼
┌────────────────────────────┐  ┌─────────────────────────────┐
│ Planning and orchestration  │  │ Domain and policy           │
│ `planner.py`, `runner.py`   │  │ `domain.py`, `context.py`   │
│ `agent_loop.py`             │  │ `tools.py`, `evaluators.py` │
└──────────────┬─────────────┘  └─────────────────────────────┘
               │ protocol-backed dependencies
               ▼
┌───────────────────┬───────────────────┬───────────────────┐
│ SQLite / memory  │ LLM + engine     │ Docker + gVisor │
│ `sqlite_store.py`│ `runtime.py`     │ `providers.py`   │
└──────────────────└───────────────────└───────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| React application shell | Mount providers, route screens, and lazy-load page-level features | `web/src/main.tsx`, `web/src/app/routes.tsx` |
| Frontend API layer | Wrap REST calls in typed TanStack Query hooks and own cache invalidation | `web/src/lib/api/client.ts`, `web/src/lib/api/` |
| FastAPI composition root | Construct shared dependencies, expose HTTP endpoints, translate errors, and sanitize responses | `api/loopforge/app.py` |
| Planner | Convert a goal into a clarity decision and guarded loop specification through an LLM | `api/loopforge/planner.py` |
| Run orchestrator | Enforce steps, context budget, gates, handoffs, evaluation, event logging, and artifact persistence | `api/loopforge/runner.py` |
| Agent engines | Drive one agent through native ReAct or the optional in-sandbox opencode runtime | `api/loopforge/agent_engine.py`, `api/loopforge/agent_loop.py`, `api/loopforge/opencode_engine.py` |
| Runtime adapters | Resolve configured LLM, sandbox, and agent-engine implementations | `api/loopforge/runtime.py`, `api/loopforge/providers.py` |
| Persistence | Present one `Store` port with SQLite and in-memory adapters | `api/loopforge/store.py`, `api/loopforge/sqlite_store.py` |
| Domain model | Define validated API, workflow, event, artifact, and persistence records | `api/loopforge/domain.py` |

## Pattern Overview

**Overall:** Two-process modular monolith with a layered React client and ports-and-adapters seams inside the Python backend.

**Key Characteristics:**
- Run the browser and ASGI server as separate processes; Vite proxies `/api` to FastAPI in development through `web/vite.config.ts`.
- Keep orchestration in application services and inject `Store`, `LLMProvider`, `SandboxProvider`, and `AgentEngine` ports rather than importing infrastructure into workflow logic.
- Treat Pydantic models in `api/loopforge/domain.py` as the backend contract and use React Query hooks in `web/src/lib/api/` as the frontend's server-state boundary.
- Persist domain records as JSON payloads behind a common store API; SQLite is the importable app default and `InMemoryStore` is the test/lightweight adapter.

## Layers

**Browser Presentation:**
- Purpose: Render operator workflows for goals, loop specs, datasets, runs, gates, results, and settings.
- Location: `web/src/pages/`, `web/src/components/`, `web/src/app/`
- Contains: Route screens, shell/navigation, reusable UI, and run visualizations.
- Depends on: Hooks and pure helpers in `web/src/lib/`; transient view state in `web/src/store/`.
- Used by: The browser entry point in `web/src/main.tsx`.

**Frontend Data Access:**
- Purpose: Centralize HTTP transport, API-shaped types, query keys, mutations, and cache updates.
- Location: `web/src/lib/api/`
- Contains: `apiFetch`, TypeScript contract types, and resource-specific TanStack Query hooks.
- Depends on: Browser `fetch` and `@tanstack/react-query`.
- Used by: Pages and data-backed components in `web/src/pages/` and `web/src/components/`.

**HTTP / Composition:**
- Purpose: Validate requests, coordinate application services, map domain failures to HTTP responses, and sanitize public output.
- Location: `api/loopforge/app.py`
- Contains: `create_app`, endpoint closures, application-wide store/tools wiring, and response helpers.
- Depends on: Every backend application service and adapter factory.
- Used by: Uvicorn through the module-level `app` object.

**Application Services:**
- Purpose: Plan loops and execute approved specs under budgets, gates, context, evaluator, and sandbox policies.
- Location: `api/loopforge/planner.py`, `api/loopforge/runner.py`, `api/loopforge/agent_loop.py`, `api/loopforge/context.py`, `api/loopforge/evaluators.py`
- Contains: `LoopPlanner`, `LoopRunner`, `AgentLoop`, `ContextManager`, and evaluator strategies.
- Depends on: Domain models and provider/store protocols.
- Used by: FastAPI route handlers in `api/loopforge/app.py`.

**Domain and Ports:**
- Purpose: Define stable records and interfaces that workflow code and adapters share.
- Location: `api/loopforge/domain.py`, `api/loopforge/store.py`, `api/loopforge/agent_engine.py`, `api/loopforge/providers.py`
- Contains: Pydantic models, enums, `Store`, `AgentEngine`, `LLMProvider`, and `SandboxProvider` protocols.
- Depends on: Pydantic and Python standard-library types.
- Used by: All backend layers.

**Infrastructure Adapters:**
- Purpose: Store records, call OpenAI-compatible endpoints, create isolated workspaces/containers, encrypt provider secrets, and select runtime implementations.
- Location: `api/loopforge/sqlite_store.py`, `api/loopforge/providers.py`, `api/loopforge/runtime.py`, `api/loopforge/secrets.py`, `api/loopforge/opencode_config.py`
- Contains: `SQLiteStore`, `OpenAICompatibleLLMProvider`, `DockerGvisorSandboxProvider`, runtime factories, and secret/config helpers.
- Depends on: SQLite, HTTPX, Docker CLI, gVisor, and optionally `opencode-ai`.
- Used by: `api/loopforge/app.py` and `api/loopforge/runner.py` through ports.

## Data Flow

### Primary Request Path

1. The browser mounts routes and providers, then a page invokes a resource hook such as `useCreateGoal` (`web/src/main.tsx:8`, `web/src/lib/api/goals.ts:17`).
2. `apiFetch` sends JSON to a FastAPI endpoint; `create_goal` validates references, persists the goal, asks `LoopPlanner` for clarity, and saves either clarification or a draft spec (`web/src/lib/api/client.ts:14`, `api/loopforge/app.py:100`).
3. After explicit spec approval, `start_run` resolves the goal-specific LLM, sandbox, evaluator, and engine and constructs `LoopRunner` (`api/loopforge/app.py:448`).
4. `LoopRunner.start` records run/context state, enforces the first budget/gate checks, and enters `_complete_execution` when allowed (`api/loopforge/runner.py:36`, `api/loopforge/runner.py:73`).
5. Each spec agent runs through `AgentEngine`; the native implementation delegates to `AgentLoop`, which repeatedly requests one JSON action and executes it in the persistent sandbox session (`api/loopforge/agent_engine.py:44`, `api/loopforge/agent_loop.py:97`).
6. The runner persists events, context, artifacts, and terminal status through `Store`; the run page polls JSON events and reduces them into UI state (`api/loopforge/runner.py:73`, `web/src/lib/api/runs.ts:22`, `web/src/pages/RunPage.tsx:31`).

### Approval Gate Resume

1. A configured autonomy gate makes `LoopRunner.start` save a pending `Gate` and a pending-approval run (`api/loopforge/runner.py:53`).
2. The operator submits a decision through `web/src/lib/api/gates.ts` to `decide_gate` (`api/loopforge/app.py:623`).
3. Rejection cancels the run; approval of all run gates rebuilds runtime dependencies and calls `LoopRunner.resume_after_gate` (`api/loopforge/app.py:645`).

**State Management:**
- Keep durable server state behind `Store`; the module-level ASGI app uses `SQLiteStore` at `.loopforge/loopforge.db`, while tests inject `InMemoryStore` through `create_app` in `api/loopforge/app.py`.
- Keep server-derived browser state in the singleton TanStack Query client from `web/src/app/Providers.tsx`; use `web/src/store/ui.ts` and `web/src/store/theme.ts` only for transient UI preferences, and use URL search params for deep-linkable run tabs in `web/src/pages/RunPage.tsx`.

## Key Abstractions

**Store:**
- Purpose: Hide persistence mechanics for goals, specs, runs, events, artifacts, context, gates, datasets, evaluators, providers, and audit events.
- Examples: `api/loopforge/store.py`, `api/loopforge/sqlite_store.py`
- Pattern: Structural `Protocol` with in-memory and SQLite adapters.

**Runtime Provider Ports:**
- Purpose: Isolate model completion and sandbox execution from planning and orchestration.
- Examples: `api/loopforge/providers.py`, `api/loopforge/runtime.py`
- Pattern: Protocols plus configuration-driven factory functions.

**AgentEngine:**
- Purpose: Let `LoopRunner` execute an agent without knowing whether native ReAct or opencode drives it.
- Examples: `api/loopforge/agent_engine.py`, `api/loopforge/opencode_engine.py`
- Pattern: Strategy port selected in `api/loopforge/runtime.py`.

**Domain Records:**
- Purpose: Validate inputs and carry workflow state consistently across HTTP, services, and persistence.
- Examples: `api/loopforge/domain.py`, `web/src/lib/api/types.ts`
- Pattern: Pydantic models on the server with matching TypeScript structural types on the client.

**Resource Hooks:**
- Purpose: Give pages one typed interface for query, mutation, and cache behavior per backend resource.
- Examples: `web/src/lib/api/goals.ts`, `web/src/lib/api/runs.ts`, `web/src/lib/api/gates.ts`
- Pattern: TanStack Query custom hooks over a shared `apiFetch` function.

## Entry Points

**Backend ASGI App:**
- Location: `api/loopforge/app.py:996`
- Triggers: `python -m uvicorn api.loopforge.app:app` as documented in `README.md`.
- Responsibilities: Load environment settings, construct persistent storage, log masked configuration, and expose the FastAPI application.

**Frontend Browser App:**
- Location: `web/src/main.tsx:8`
- Triggers: Vite serves `web/index.html`, whose root node is mounted by the module script.
- Responsibilities: Install Strict Mode, browser routing, TanStack Query, and application routes.

**Run Execution:**
- Location: `api/loopforge/app.py:448`
- Triggers: `POST /api/goals/{goalId}/runs` after the referenced loop spec is approved.
- Responsibilities: Resolve adapters and synchronously start or gate a guarded run.

## Architectural Constraints

- **Threading:** FastAPI sync route handlers run in its threadpool; a run is executed synchronously inside the start or gate-decision request. `SQLiteStore` shares one `check_same_thread=False` connection guarded by an `RLock` in `api/loopforge/sqlite_store.py`.
- **Global state:** The importable app owns one settings object, store, secret cipher, and tool registry through closures in `api/loopforge/app.py`; the frontend owns one module-level `QueryClient` in `web/src/app/Providers.tsx`.
- **Circular imports:** None detected in the internal import graph. Keep `api/loopforge/domain.py` dependency-light and keep adapter selection in `api/loopforge/runtime.py` to preserve the acyclic direction.
- **Process boundary:** Browser and backend communicate only through `/api`; the backend and generated agent code communicate through sandbox/provider ports, with datasets mounted read-only under `/workspace/data`.
- **Persistence shape:** `SQLiteStore` uses a single `records` table of Pydantic JSON payloads indexed by `kind`, `goal_id`, and `run_id`; query patterns must fit those fields unless the store schema changes.
- **Security boundary:** Treat goal text, dataset values, model output, artifact metadata, and file paths as untrusted; preserve validation, output sanitization, path containment checks, and sandbox isolation in `api/loopforge/app.py`, `api/loopforge/agent_loop.py`, and `api/loopforge/providers.py`.

## Anti-Patterns

### Adding More Endpoint Domains to the Composition Root

**What happens:** `api/loopforge/app.py` contains all route groups, dependency composition, transport translation, result assembly, and sanitization in one file.
**Why it's wrong:** New endpoint domains increase coupling and make route-specific behavior harder to navigate and test without loading an already large module.
**Do this instead:** Keep `create_app` as the composition root, but place a new substantial route domain in a focused router module under `api/loopforge/` once it cannot reuse an existing endpoint group.

### Bypassing the Existing Ports

**What happens:** Direct SQLite, HTTP, Docker, or engine calls from route handlers or domain helpers would skip the tested seams already used by `LoopRunner` and `LoopPlanner`.
**Why it's wrong:** It duplicates configuration/error handling and prevents `InMemoryStore` and fake providers from exercising the same workflow.
**Do this instead:** Extend the nearest existing protocol in `api/loopforge/store.py`, `api/loopforge/providers.py`, or `api/loopforge/agent_engine.py`, then supply the implementation through `api/loopforge/runtime.py` or `create_app`.

## Error Handling

**Strategy:** Validate at the transport/domain boundary, translate expected failures into explicit HTTP responses, and turn execution failures into persisted terminal run states rather than fabricated output.

**Patterns:**
- Catch missing store records at endpoints and raise `HTTPException` with 404; use 409 for invalid workflow transitions in `api/loopforge/app.py`.
- Wrap malformed LLM planning output in `PlannerError`, retry spec JSON once, and translate provider/planner failures with `_planner_http_error` in `api/loopforge/planner.py` and `api/loopforge/app.py`.
- Catch sandbox/agent failures inside `LoopRunner` and persist `FAILED`, `BUDGET_EXHAUSTED`, or `CONTEXT_OVERFLOW` plus a run event in `api/loopforge/runner.py`.
- Throw `ApiError` for non-2xx browser requests in `web/src/lib/api/client.ts`; pages render resource-specific messages without fake success fallbacks.

## Cross-Cutting Concerns

**Logging:** Persist product-relevant activity as `RunEvent` and `AuditEvent` through `Store`; startup configuration is printed with secret masking in `api/loopforge/app.py`.
**Validation:** Use Pydantic field constraints and enums in `api/loopforge/domain.py`, explicit workflow checks in `api/loopforge/app.py`, loop-graph checks in `web/src/lib/validateLoopGraph.ts`, and sandbox path/tool guards in `api/loopforge/providers.py` and `api/loopforge/agent_loop.py`.
**Authentication:** Not detected. The current app is local-first, allows only the Vite origin through CORS in `api/loopforge/app.py`, and exposes no user/session authorization layer.

---

*Architecture analysis: 2026-07-11*
