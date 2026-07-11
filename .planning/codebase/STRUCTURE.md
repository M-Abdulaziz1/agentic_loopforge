# Codebase Structure

**Analysis Date:** 2026-07-11

## Directory Layout

```text
agentic_loopforge/
├── api/loopforge/          # FastAPI app, domain, orchestration, and infrastructure adapters
├── web/                    # React/Vite operator interface
│   ├── src/app/            # Providers, routes, and navigation metadata
│   ├── src/components/     # Reusable brand, shell, run, and UI components
│   ├── src/lib/api/        # HTTP client, API types, and resource query hooks
│   ├── src/pages/          # Route-level feature screens and colocated tests
│   ├── src/store/          # Small Zustand stores for client-only state
│   └── src/test/           # Shared browser-test setup, fixtures, and MSW server
├── tests/                  # Python backend, contract, integration, and security tests
│   └── security/           # Guardrail-focused backend tests
├── docker/                 # Sandbox and opencode container images
├── docs/                   # Contracts, design records, plans, and backlog
│   ├── contract/           # OpenAPI and LLM prompt contracts
│   └── superpowers/        # Dated design and implementation plans
├── .planning/codebase/     # Generated GSD codebase map
├── .loopforge/             # Ignored local database, datasets, and runtime state
├── pyproject.toml          # Python package metadata and pytest configuration
└── README.md               # Two-process development and runtime instructions
```

## Directory Purposes

**`api/loopforge/`:**
- Purpose: Own the complete Python backend from HTTP transport through guarded agent execution and persistence.
- Contains: Flat, domain-named Python modules rather than nested packages.
- Key files: `api/loopforge/app.py`, `api/loopforge/domain.py`, `api/loopforge/runner.py`, `api/loopforge/providers.py`, `api/loopforge/store.py`

**`web/src/app/`:**
- Purpose: Assemble the browser application independently of individual feature screens.
- Contains: Provider composition, lazy route declarations, and sidebar navigation metadata.
- Key files: `web/src/app/Providers.tsx`, `web/src/app/routes.tsx`, `web/src/app/nav.ts`

**`web/src/pages/`:**
- Purpose: Own one route-level workflow per page.
- Contains: Goal, spec, loop-builder, template, dataset, evaluator, run, results, context, gate, and settings screens with colocated `*.test.tsx` files.
- Key files: `web/src/pages/GoalCreatePage.tsx`, `web/src/pages/LoopSpecPage.tsx`, `web/src/pages/RunPage.tsx`, `web/src/pages/ResultsPage.tsx`

**`web/src/components/`:**
- Purpose: Hold reusable visual units below the route level.
- Contains: `brand/` identity, `shell/` layout/navigation, `run/` agent/artifact views, and `ui/` primitives.
- Key files: `web/src/components/shell/AppLayout.tsx`, `web/src/components/run/AgentPipeline.tsx`, `web/src/components/ui/GlassCard.tsx`

**`web/src/lib/`:**
- Purpose: Hold non-visual browser logic and backend access.
- Contains: Pure workflow/view reducers, graph builders/validators, query-client setup, CSS helper, and the `api/` resource layer.
- Key files: `web/src/lib/api/client.ts`, `web/src/lib/api/types.ts`, `web/src/lib/runEvents.ts`, `web/src/lib/validateLoopGraph.ts`

**`web/src/store/`:**
- Purpose: Hold client-only state that is neither server data nor naturally encoded in a route.
- Contains: Zustand stores for selected run agent and theme preference.
- Key files: `web/src/store/ui.ts`, `web/src/store/theme.ts`

**`tests/`:**
- Purpose: Verify backend domain behavior, ports/adapters, HTTP contracts, run orchestration, and security guardrails.
- Contains: Root `test_*.py` modules, shared fixtures in `tests/conftest.py`, and `tests/security/`.
- Key files: `tests/test_api.py`, `tests/test_runner.py`, `tests/test_sqlite_store.py`, `tests/security/test_guardrails.py`

**`docker/`:**
- Purpose: Define isolated execution environments used by sandbox providers.
- Contains: A data-science Python sandbox and an opencode-serving sandbox.
- Key files: `docker/sandbox.Dockerfile`, `docker/opencode-sandbox.Dockerfile`

**`docs/`:**
- Purpose: Preserve API/prompt contracts and dated product/implementation design material.
- Contains: `contract/`, `superpowers/specs/`, `superpowers/plans/`, `BACKLOG.md`, and opencode operating notes.
- Key files: `docs/contract/openapi.yaml`, `docs/contract/llm-prompts.md`, `docs/opencode.md`

## Key File Locations

**Entry Points:**
- `api/loopforge/app.py`: Exports the module-level FastAPI `app` consumed by Uvicorn.
- `web/index.html`: Supplies the browser root element and loads the Vite module.
- `web/src/main.tsx`: Mounts React, router, query provider, and route tree.

**Configuration:**
- `pyproject.toml`: Python version, runtime/dev dependencies, and pytest settings.
- `api/loopforge/settings.py`: Environment-backed runtime settings and defaults.
- `.env.example`: Committed environment-variable template; the local `.env` exists but must not be read or committed.
- `web/package.json`: Frontend dependencies and dev/build/test/lint scripts.
- `web/vite.config.ts`: React/Tailwind plugins, backend proxy, and Vitest environment.
- `web/tsconfig.json`, `web/tsconfig.app.json`, `web/tsconfig.node.json`: TypeScript project configuration.
- `web/.oxlintrc.json`: Frontend lint configuration.

**Core Logic:**
- `api/loopforge/domain.py`: Backend domain and transport models.
- `api/loopforge/app.py`: HTTP endpoints and dependency composition.
- `api/loopforge/planner.py`: Goal clarification and loop-spec generation.
- `api/loopforge/runner.py`: Budgeted/gated multi-agent run orchestration.
- `api/loopforge/agent_loop.py`: Native JSON action/observation loop.
- `api/loopforge/agent_engine.py`: Engine port and native adapter.
- `api/loopforge/opencode_engine.py`: Optional opencode engine adapter.
- `api/loopforge/context.py`: Context selection, compaction, and overflow policy.
- `api/loopforge/evaluators.py`: Candidate evaluation strategies.
- `api/loopforge/providers.py`: LLM and sandbox ports/adapters.
- `api/loopforge/runtime.py`: Configuration-to-adapter factories.
- `api/loopforge/store.py`, `api/loopforge/sqlite_store.py`: Persistence port and adapters.
- `web/src/lib/api/`: Browser API boundary.
- `web/src/pages/`: Operator workflows.

**Testing:**
- `tests/conftest.py`: Shared Python fixtures.
- `tests/test_*.py`: Backend unit/HTTP/integration tests by module or capability.
- `tests/security/test_guardrails.py`: Sandbox and trust-boundary regression tests.
- `web/src/test/setup.ts`: Vitest cleanup and MSW lifecycle.
- `web/src/test/msw.ts`: Shared mock API handlers.
- `web/src/test/fixtures.ts`: Shared frontend model fixtures.
- `web/src/**/*.test.ts`, `web/src/**/*.test.tsx`: Colocated frontend tests.

## Naming Conventions

**Files:**
- Use lowercase snake_case for Python modules: `api/loopforge/sqlite_store.py`, `tests/test_runner_agent_loop.py`.
- Name Python tests `test_<subject>.py`, with the security suite nested under `tests/security/`.
- Use PascalCase for React component/page modules: `web/src/pages/GoalCreatePage.tsx`, `web/src/components/run/AgentNode.tsx`.
- Use lower camelCase for non-component TypeScript modules: `web/src/lib/runEvents.ts`, `web/src/lib/api/llmProviders.ts`.
- Colocate frontend tests as `<module>.test.ts` or `<Component>.test.tsx` beside the implementation.
- Use uppercase names for generated GSD reference documents in `.planning/codebase/`.

**Directories:**
- Use lowercase domain names at top level: `api/`, `web/`, `tests/`, `docker/`, `docs/`.
- Group frontend code first by role (`pages`, `components`, `lib`, `store`), then by feature where multiple components share a concern (`components/run`, `lib/api`).
- Keep the backend as a flat `api/loopforge/` package while modules remain single-domain and navigable; do not add a nested package for one file.

## Where to Add New Code

**New Backend Feature:**
- Primary code: Add domain records to `api/loopforge/domain.py`, workflow behavior to the closest focused module in `api/loopforge/`, and expose it through `api/loopforge/app.py`.
- Persistence: Extend `Store` in `api/loopforge/store.py` and both adapters in `api/loopforge/store.py` and `api/loopforge/sqlite_store.py` only when the feature has durable state.
- Tests: Add `tests/test_<feature>.py`; add HTTP contract coverage to `tests/test_contract_api.py` when the public API changes.

**New Frontend Feature:**
- Route screen: `web/src/pages/<Feature>Page.tsx`, registered lazily in `web/src/app/routes.tsx`.
- API access: `web/src/lib/api/<resource>.ts`, reusing `web/src/lib/api/client.ts` and types from `web/src/lib/api/types.ts`.
- Tests: Colocate `web/src/pages/<Feature>Page.test.tsx` and reuse `web/src/test/msw.ts` for transport behavior.

**New Component/Module:**
- Generic UI primitive: `web/src/components/ui/<Component>.tsx`.
- Run-specific visual: `web/src/components/run/<Component>.tsx`.
- Shell/navigation component: `web/src/components/shell/<Component>.tsx`.
- Pure frontend workflow helper: `web/src/lib/<helper>.ts` with a colocated `.test.ts` when it contains branching logic.
- Backend adapter: Implement the existing port in `api/loopforge/providers.py`, `api/loopforge/store.py`, or `api/loopforge/agent_engine.py`, then select it in `api/loopforge/runtime.py`.

**Utilities:**
- Shared frontend helpers: `web/src/lib/`; reuse `web/src/lib/cn.ts` for class composition.
- Shared backend helpers: Keep them in the domain module that owns the behavior; create a new `api/loopforge/<domain>.py` only when no existing module owns it.

## Special Directories

**`.loopforge/`:**
- Purpose: Store the local SQLite database, uploaded datasets, and database sidecar/backup files.
- Generated: Yes
- Committed: No; excluded by `.gitignore`.

**`.planning/codebase/`:**
- Purpose: Store generated GSD reference maps consumed by planning and execution workflows.
- Generated: Yes
- Committed: Yes when the mapping workflow commits documentation.

**`web/dist/`:**
- Purpose: Hold Vite production build output.
- Generated: Yes
- Committed: No; `dist/` is excluded by `.gitignore`.

**`web/node_modules/` and root `node_modules/`:**
- Purpose: Hold locally installed JavaScript dependencies and tooling caches.
- Generated: Yes
- Committed: No; `node_modules/` is excluded by `.gitignore`.

**`loopforge.egg-info/`, `.pytest_cache/`, `.ruff_cache/`, and `__pycache__/`:**
- Purpose: Hold Python packaging, test, lint, and bytecode metadata.
- Generated: Yes
- Committed: No; all matching paths are excluded by `.gitignore`.

**`.superpowers/`:**
- Purpose: Hold local design-tool session state separate from the committed plans in `docs/superpowers/`.
- Generated: Yes
- Committed: No; excluded by `.gitignore`.

**`docs/contract/`:**
- Purpose: Define the public OpenAPI surface and LLM prompt contracts used as executable design references.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-07-11*
