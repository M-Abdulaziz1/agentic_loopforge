# Coding Conventions

**Analysis Date:** 2026-07-11

## Naming Patterns

**Files:**
- Use lowercase `snake_case.py` for Python modules, as in `api/loopforge/agent_engine.py` and `api/loopforge/sqlite_store.py`.
- Use `PascalCase.tsx` for React component and page modules, as in `web/src/components/ui/Toggle.tsx` and `web/src/pages/GoalCreatePage.tsx`.
- Use lower `camelCase.ts` for TypeScript utilities, stores, and API modules, as in `web/src/lib/buildAgentFlow.ts`, `web/src/store/theme.ts`, and `web/src/lib/api/goals.ts`.
- Name Python tests `tests/test_<subject>.py`; name frontend tests `<subject>.test.ts` or `<Component>.test.tsx` beside the implementation.

**Functions:**
- Use `snake_case` for Python functions and methods, including private helpers prefixed with `_`, as in `api/loopforge/app.py` and `api/loopforge/evaluators.py`.
- Use `camelCase` for TypeScript helpers and `PascalCase` for React components; prefix React Query hooks with `use`, as in `web/src/lib/api/goals.ts`.
- Name tests as behavioral sentences: `test_<expected_behavior>` in Python and `test("<expected behavior>", ...)` in TypeScript.

**Variables:**
- Use `snake_case` in Python and `camelCase` in TypeScript.
- Use uppercase `SCREAMING_SNAKE_CASE` for module-level constants, as in `web/src/pages/GoalsListPage.tsx` and `web/src/pages/RunPage.tsx`.
- Prefer short local aliases only when the role is conventional and obvious, such as `qc` for the React Query client in `web/src/lib/api/goals.ts`.

**Types:**
- Use `PascalCase` for Python classes, protocols, enums, Pydantic models, TypeScript types, and component prop types.
- Use singular domain names for models and protocols, such as `Goal`, `LoopSpec`, `LLMProvider`, and `SandboxProvider` in `api/loopforge/domain.py` and `api/loopforge/providers.py`.
- Express fixed string sets with Python `StrEnum`/`Literal` and TypeScript string unions, following `api/loopforge/domain.py` and `web/src/lib/api/types.ts`.

## Code Style

**Formatting:**
- No formatter configuration is present. Match the existing four-space Python indentation and two-space TypeScript indentation.
- Keep Python type annotations on functions and data-bearing variables. `pyproject.toml` requires Python 3.12, and modules commonly start with `from __future__ import annotations`.
- Use double quotes in TypeScript, trailing commas in multiline constructs, and semicolons, following `web/src/lib/api/client.ts` and `web/src/components/ui/Toggle.tsx`.
- Keep JSX props one per line when multiline and compose class names with `cn(...)` from `web/src/lib/cn.ts`.

**Linting:**
- Run Oxlint for frontend changes with `npm --prefix web run lint`; the script is defined in `web/package.json`.
- No repository-level Python linter or checked-in Oxlint rule file is detected. Preserve nearby style rather than assuming undocumented rules.
- Run the TypeScript compiler through `npm --prefix web run build`; `web/tsconfig.app.json` supplies the application compiler rules.

## Import Organization

**Order:**
1. Put `from __future__ import annotations` first in Python modules that use it.
2. Group Python standard-library imports, then third-party packages, then absolute `api.loopforge...` imports, separated by blank lines, following `api/loopforge/domain.py` and `api/loopforge/providers.py`.
3. In TypeScript, put package imports before relative imports and use `import type` for type-only dependencies, following `web/src/pages/ResultsPage.tsx` and `web/src/lib/api/goals.ts`.

**Path Aliases:**
- No source path aliases are configured; use absolute package imports in Python (`api.loopforge...`) and relative imports in `web/src/`.

## Error Handling

**Patterns:**
- Raise focused domain exceptions at provider and service boundaries, preserving the original exception with `raise ... from exc`, as in `api/loopforge/providers.py`.
- Translate missing resources and invalid state into explicit FastAPI `HTTPException` status/detail pairs at the API boundary in `api/loopforge/app.py`.
- Catch only expected exception types. Use broad catches only at an external boundary where the response is intentionally normalized, as in provider testing and dataset profiling in `api/loopforge/app.py`.
- Return stable result objects for normal execution outcomes and reserve exceptions for failures, following `SandboxResult` and `LLMResponse` in `api/loopforge/providers.py`.
- Throw `ApiError` for non-2xx frontend requests through the single `apiFetch` boundary in `web/src/lib/api/client.ts`; narrow `unknown` errors before displaying user-facing messages in pages such as `web/src/pages/GoalCreatePage.tsx`.

## Logging

**Framework:** Not detected

**Patterns:**
- No application-level `logging`, logger, or `console.*` calls are present in `api/loopforge/` or `web/src/`.
- Record run behavior as persisted domain events through the store/runner path rather than adding incidental console output; see `api/loopforge/runner.py` and `api/loopforge/store.py`.
- Keep secrets and raw dataset values out of error detail and event payloads; security expectations are exercised in `tests/security/test_guardrails.py`.

## Comments

**When to Comment:**
- Comment the reason for a non-obvious platform, security, or compatibility choice, not a restatement of the code. Examples include the jsdom `ResizeObserver` shim in `web/src/test/setup.ts` and sandbox mount/permission rationale in `api/loopforge/providers.py`.
- Use `ponytail:` comments only for deliberate simplifications with a named ceiling and upgrade condition, following `api/loopforge/providers.py`.
- Keep contract-sensitive comments adjacent to the behavior they protect, as in the OpenAPI-aligned handlers in `web/src/test/msw.ts`.

**JSDoc/TSDoc:**
- Python docstrings are used selectively for public abstractions and security-sensitive behavior in `api/loopforge/providers.py`; most straightforward functions are self-documenting.
- JSDoc/TSDoc is not a regular frontend convention; use explicit TypeScript types and clear names instead.

## Function Design

**Size:** Keep domain helpers and React Query hooks focused on one operation. Page components and the FastAPI composition root may coordinate larger flows, with repeated transformations extracted into nearby private helpers, as in `web/src/pages/ResultsPage.tsx` and `api/loopforge/app.py`.

**Parameters:** Use keyword-only parameters for Python functions with several same-typed or optional arguments, as in `api/loopforge/providers.py`; use typed props objects and destructuring for React components, as in `web/src/components/ui/Toggle.tsx`.

**Return Values:** Annotate Python return values and use Pydantic models, dataclasses, protocols, and explicit unions. Use generic `Promise<T>` results at the TypeScript API boundary and typed React Query hooks in `web/src/lib/api/`.

## Module Design

**Exports:** Keep Python public types/functions directly in their owning module. In TypeScript, use named exports for components, hooks, utilities, fixtures, and stores; `ApiError` and `apiFetch` in `web/src/lib/api/client.ts` are representative.

**Barrel Files:** Barrel re-exports are not used. `api/loopforge/__init__.py` is minimal, and frontend consumers import directly from concrete modules.

---

*Convention analysis: 2026-07-11*
