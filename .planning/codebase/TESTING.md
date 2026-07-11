# Testing Patterns

**Analysis Date:** 2026-07-11

## Test Framework

**Runner:**
- pytest 8.x for Python backend tests.
- Config: `pyproject.toml`
- Vitest 4.1.9 with jsdom for frontend tests.
- Config: `web/vite.config.ts`

**Assertion Library:**
- Plain Python `assert` plus `pytest.raises` for backend tests.
- Vitest `expect` plus `@testing-library/jest-dom` matchers for frontend tests.

**Run Commands:**
```bash
./.venv/bin/python -m pytest       # Run all backend tests
npm --prefix web test              # Run all frontend tests once
npm --prefix web run test:watch    # Watch frontend tests
```

## Test File Organization

**Location:**
- Keep backend tests in the separate `tests/` tree, with security-specific checks in `tests/security/` and shared fixtures in `tests/conftest.py`.
- Co-locate frontend tests with their page, component, store, or utility implementation under `web/src/`; keep shared browser-test infrastructure in `web/src/test/`.

**Naming:**
- Use `test_<subject>.py` and `test_<behavior>()` for Python.
- Use `<subject>.test.ts` for non-JSX utilities and `<Component>.test.tsx` for React components/hooks.

**Structure:**
```
tests/
├── conftest.py
├── test_<backend_area>.py
└── security/test_guardrails.py

web/src/
├── **/<subject>.test.ts(x)
└── test/{setup.ts,msw.ts,fixtures.ts,smoke.test.tsx}
```

## Test Structure

**Suite Organization:**
```python
def test_openai_compatible_provider_raises_clear_error_on_bad_response() -> None:
    provider = OpenAICompatibleLLMProvider(...)

    with pytest.raises(LLMProviderError, match="500"):
        provider.complete(system="system", prompt="prompt")
```

```typescript
test("submitting routes to clarification when the API returns a session", async () => {
  render(<Providers><MemoryRouter>...</MemoryRouter></Providers>);
  await userEvent.click(screen.getByRole("button", { name: /Create/ }));
  expect(await screen.findByTestId("loc")).toHaveTextContent("/clarify");
});
```

**Patterns:**
- Build the smallest real subject in each test, perform one behavior, then assert externally visible state. Representative files are `tests/test_tools.py` and `web/src/components/ui/Toggle.test.tsx`.
- Use pytest built-ins such as `tmp_path` and `monkeypatch`; use the autouse deterministic provider fixture in `tests/conftest.py` for API tests.
- Use `render`, `renderHook`, accessible `screen.getByRole`/`getByLabelText` queries, and `userEvent` for frontend behavior; use `findBy*` or `waitFor` for asynchronous state.
- Avoid broad `describe` nesting; tests are mostly flat and behavior-named in both suites.

## Mocking

**Framework:** pytest `monkeypatch`, injected fakes/callables, `httpx.MockTransport`, Vitest `vi`, and MSW 2.14.6.

**Patterns:**
```python
def handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

client = httpx.Client(transport=httpx.MockTransport(handler))
```

```typescript
server.use(
  http.post("/api/goals", () =>
    HttpResponse.json({ goal: sampleGoal, clarification: sampleClarification }, { status: 201 }),
  ),
);
```

**What to Mock:**
- Replace external LLM, HTTP, Docker/process, browser fetch, and API boundaries with deterministic in-process fakes. See `tests/conftest.py`, `tests/test_openai_compatible_provider.py`, `tests/test_docker_gvisor_provider.py`, and `web/src/test/msw.ts`.
- Inject command runners and readiness probes rather than starting Docker in ordinary unit tests, following `api/loopforge/providers.py` tests.
- Override only the handler needed for a frontend scenario with `server.use(...)`; shared default contract handlers belong in `web/src/test/msw.ts`.

**What NOT to Mock:**
- Do not mock Pydantic domain models, stores, graph reducers/validators, React Query hooks under test, or user interaction semantics.
- Use real temporary SQLite databases and directories for persistence/filesystem behavior, as in `tests/test_sqlite_store.py` and `tests/test_datasets_api.py`.
- Use real FastAPI `TestClient` request/response behavior for API integration tests in `tests/test_api.py` and `tests/test_contract_api.py`.

## Fixtures and Factories

**Test Data:**
```typescript
export const sampleGoal: Goal = {
  id: "goal_churn_q2",
  // complete contract-shaped fields
};
```

```python
@pytest.fixture(autouse=True)
def deterministic_app_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: DeterministicPlannerLLM())
```

**Location:**
- Put cross-suite backend providers and environment fixtures in `tests/conftest.py`; keep test-local fakes beside the tests when only one file uses them.
- Put reusable frontend contract objects in `web/src/test/fixtures.ts`, default API handlers in `web/src/test/msw.ts`, and global cleanup/shims in `web/src/test/setup.ts`.

## Coverage

**Requirements:** No numeric threshold is enforced. `@vitest/coverage-v8` is installed in `web/package.json`, but no coverage script or threshold is configured; no Python coverage plugin/config is detected.

**View Coverage:**
```bash
npm --prefix web test -- --coverage  # Frontend V8 coverage
```

## Test Types

**Unit Tests:**
- Exercise domain models, context packing, tool permissions, evaluators, graph validation, reducers, components, stores, and API client behavior directly. Examples: `tests/test_domain.py`, `tests/test_context.py`, `web/src/lib/validateLoopGraph.test.ts`, and `web/src/components/ui/Toggle.test.tsx`.

**Integration Tests:**
- Exercise FastAPI routes through `TestClient`, SQLite persistence through reopen cycles, and provider adapters through injected transports/runners in `tests/test_api.py`, `tests/test_sqlite_store.py`, and `tests/test_providers.py`.
- Exercise rendered pages and React Query hooks with real providers/router state and MSW-backed HTTP in `web/src/pages/GoalCreatePage.test.tsx` and `web/src/lib/api/goals.test.tsx`.
- Keep contract and guardrail coverage explicit in `tests/test_contract_api.py`, `tests/security/test_guardrails.py`, and the OpenAPI-aligned handlers in `web/src/test/msw.ts`.

**E2E Tests:**
- No browser automation framework is used. The broadest current checks are in-process FastAPI integration tests and jsdom page tests.

## Common Patterns

**Async Testing:**
```typescript
const { result } = renderHook(() => useGoal("goal_churn_q2"), { wrapper: Providers });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

**Error Testing:**
```python
with pytest.raises(ToolUnavailableError, match="not allowed"):
    registry.require_available(...)
```

```typescript
await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
```

---

*Testing analysis: 2026-07-11*
