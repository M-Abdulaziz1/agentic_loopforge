# Codebase Concerns

**Analysis Date:** 2026-07-11

## Tech Debt

**Run budgets are only partially enforced:**
- Issue: Goals define `max_steps`, `max_llm_calls`, and context limits, but execution only rejects additional steps. `_record_llm_call()` increments a counter without checking `max_llm_calls`, while `spent_usd` is never populated.
- Files: `api/loopforge/domain.py`, `api/loopforge/runner.py`, `api/loopforge/opencode_engine.py`
- Impact: A run can exceed the operator's declared LLM-call budget and the Results cost field remains unknown, weakening the platform's central bounded-autonomy contract.
- Fix approach: Enforce `goal.budget.max_llm_calls` before every provider call through the shared counting hook, terminate with `budget_exhausted`, and either calculate `spent_usd` from provider usage or remove the unsupported field.

**API composition is concentrated in one module:**
- Issue: `create_app()` contains goals, clarification, specs, templates, providers, datasets, evaluators, runs, files, results, context, and gate endpoints plus helpers in a 998-line module.
- Files: `api/loopforge/app.py`
- Impact: Changes to unrelated API areas collide in the same file, and security or lifecycle behavior is easy to apply inconsistently.
- Fix approach: Split routers only along existing resource boundaries when the next affected endpoint is changed; retain shared validation and sanitization helpers in one location rather than duplicating them.

**Persistence has no schema evolution model:**
- Issue: All domain objects are serialized as JSON into one generic `records` table created at startup; there is no schema version, migration runner, or compatibility adapter.
- Files: `api/loopforge/sqlite_store.py`, `api/loopforge/domain.py`
- Impact: Renaming or tightening a Pydantic field can make historical rows fail to deserialize after deployment.
- Fix approach: Add a small database schema version and explicit payload migrations before making the first backward-incompatible domain-model change.

**Referential integrity is application-only:**
- Issue: Provider, dataset, and evaluator records can be deleted while goals still reference their IDs because the generic JSON store has no foreign keys or reference checks.
- Files: `api/loopforge/app.py`, `api/loopforge/sqlite_store.py`, `api/loopforge/store.py`, `api/loopforge/domain.py`
- Impact: Later planning or execution can encounter an unhandled `KeyError` or lose the configuration needed to reproduce an existing goal.
- Fix approach: Reject deletion with `409` while a live goal references the record, or snapshot the referenced configuration into the goal/run before allowing deletion.

**Backlog state is stale:**
- Issue: The backlog says templates and loop-spec editing backends are pending even though those routes exist.
- Files: `docs/BACKLOG.md`, `api/loopforge/app.py`
- Impact: Planning can duplicate completed work or prioritize a non-existent gap.
- Fix approach: Reconcile `docs/BACKLOG.md` against the current endpoints and tests after the active worktree changes settle.

## Known Bugs

**LLM-call limit does not stop calls:**
- Symptoms: A goal with `budget.max_llm_calls` set to `0` can still invoke planning and run-time providers; only `spent_llm_calls` changes.
- Files: `api/loopforge/domain.py`, `api/loopforge/runner.py`, `api/loopforge/planner.py`
- Trigger: Create or execute a goal whose `max_llm_calls` is below the calls required by the planner/agents.
- Workaround: Set a low `max_steps` and enforce provider quotas outside LoopForge.

**Pause and cancel do not interrupt active execution:**
- Symptoms: The endpoints save `pending_approval` or `cancelled`, but the already-running `LoopRunner` has no cancellation token and later saves its local run object as `completed`, `failed`, or `budget_exhausted`.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/agent_loop.py`, `api/loopforge/opencode_engine.py`
- Trigger: Call `/api/runs/{runId}/pause` or `/api/runs/{runId}/cancel` while an LLM or sandbox turn is in progress.
- Workaround: Stop the serving process or sandbox container externally; do not rely on these endpoints to halt active compute.

**Paused runs have no general resume path:**
- Symptoms: `/pause` moves any run to `pending_approval`, but resumption is implemented only as a side effect of approving all stored gates. A manually paused run without a pending gate stays paused.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`
- Trigger: POST `/api/runs/{runId}/pause` for a run that has no pending configured gate.
- Workaround: Start a new run from the approved loop spec.

**Concurrent event writers can assign duplicate sequence numbers:**
- Symptoms: `append_event()` calculates `len(list_events()) + 1` separately from the locked write. The opencode event-pump thread and runner thread can observe the same length and persist duplicate `seq` values.
- Files: `api/loopforge/sqlite_store.py`, `api/loopforge/opencode_engine.py`, `api/loopforge/runner.py`
- Trigger: Emit an opencode stream event concurrently with a runner status or budget event.
- Workaround: Consumers must not assume `seq` is globally unique under concurrent execution.

**Frontend lint is red:**
- Symptoms: `npm run lint` reports `react-hooks/rules-of-hooks` because an event handler is named `useTemplate`; the same run also reports a Fast Refresh warning for a mixed component/helper export.
- Files: `web/src/pages/TemplatesPage.tsx`, `web/src/components/run/NodeConfigPanel.tsx`
- Trigger: Run `npm run lint` from `web/`.
- Workaround: The production build and Vitest suite still pass; rename the handler and move the shared export only if Fast Refresh matters.

**Parquet uploads are accepted but never profiled:**
- Symptoms: `.parquet` passes the upload type check, is stored, and is then always marked `failed` because no Parquet reader is installed.
- Files: `api/loopforge/app.py`, `api/loopforge/datasets.py`, `pyproject.toml`
- Trigger: Upload any file with a `.parquet` suffix.
- Workaround: Convert the dataset to CSV before upload.

## Security Considerations

**No authentication or authorization boundary:**
- Risk: Any caller that can reach the API can list data, create provider configurations, start expensive agent runs, read workspace files/artifacts, approve gates, and delete resources. CORS limits browser origins but is not access control.
- Files: `api/loopforge/app.py`, `web/src/lib/api/client.ts`
- Current mitigation: The documented deployment is local development and CORS permits only `http://localhost:5173` in browsers.
- Recommendations: Keep the service bound to a trusted local/private interface until authentication exists; before shared deployment, add identity, per-resource ownership, and authorization around every `/api` route.

**Static development encryption key is a production foot-gun:**
- Risk: Stored provider API keys are encrypted, but the default application key is a public constant. A deployment that omits `LOOPFORGE_SECRET_KEY` has reversible credentials, and startup logs expose the first three key characters.
- Files: `api/loopforge/settings.py`, `api/loopforge/app.py`, `api/loopforge/secrets.py`
- Current mitigation: Provider responses omit the encrypted key and tests verify plaintext keys are not stored or returned; the credential implementation file exists and was not inspected under mapper secret-handling rules.
- Recommendations: Refuse the default key outside explicit development mode, stop logging any key prefix, and source the key from a secret manager or protected environment variable.

**User-configurable provider URLs enable server-side requests:**
- Risk: A caller can store an arbitrary `base_url` and make LoopForge connect to it via provider testing, planning, or run execution, including internal network addresses reachable by the API process.
- Files: `api/loopforge/app.py`, `api/loopforge/providers.py`, `api/loopforge/runtime.py`, `api/loopforge/domain.py`
- Current mitigation: HTTP calls have configurable timeouts and provider error text is sanitized for bearer tokens.
- Recommendations: For any non-local deployment, validate schemes, block link-local/metadata/private destinations unless explicitly allowlisted, and resolve/re-check destinations at connection time to limit DNS rebinding.

**Upload size is checked after buffering the full request:**
- Risk: `await request.body()` loads the complete multipart request into memory before applying `dataset_max_size_bytes`, so oversized or concurrent uploads can exhaust API memory.
- Files: `api/loopforge/app.py`, `api/loopforge/datasets.py`, `api/loopforge/settings.py`
- Current mitigation: Parsed dataset content is rejected when it exceeds the configured default of 256 MiB.
- Recommendations: Enforce body limits at the reverse proxy and stream uploads to a bounded temporary file before parsing.

**Online sandbox safety depends on external network setup:**
- Risk: In online mode the opencode config allows network tools and the container joins a named Docker network. The repository does not create or verify that this network is an egress allowlist, so an operator-created open bridge broadens access beyond the stated policy.
- Files: `api/loopforge/opencode_config.py`, `api/loopforge/providers.py`, `api/loopforge/settings.py`, `docs/opencode.md`
- Current mitigation: Containers use gVisor, non-root users, read-only roots, dropped capabilities, resource limits, and workspace-scoped mounts; offline code execution defaults to network `none`.
- Recommendations: Fail startup or online run creation unless the configured network passes an explicit allowlist check, and document/test the required firewall or proxy controls.

**Sanitization covers only narrow PII patterns:**
- Risk: Artifact, result, and context output removes email addresses and US SSN-shaped strings, but can expose API tokens, phone numbers, addresses, dataset values, or other identifiers generated into agent output.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`
- Current mitigation: Dataset profiles mask raw values and provider errors redact known API keys and bearer tokens.
- Recommendations: Treat artifact/context access as sensitive through authorization first; add configurable redaction only for the deployment's actual data policy rather than relying on two regexes.

## Performance Bottlenecks

**Runs execute inside request workers:**
- Problem: Starting a run and approving its final gate synchronously perform all LLM, sandbox, evaluation, and opencode work before returning.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/opencode_engine.py`
- Cause: There is no durable job queue or background worker; provider calls can block for up to 900 seconds by default.
- Improvement path: Move execution to a worker only when concurrent or restart-safe runs are required; return the persisted run immediately and make lifecycle controls cooperative.

**SSE repeatedly scans complete event history:**
- Problem: Every connected stream polls every 100 ms and calls `list_events()`, which fetches and deserializes all events before filtering by `last_seq`.
- Files: `api/loopforge/app.py`, `api/loopforge/sqlite_store.py`, `api/loopforge/store.py`
- Cause: The store exposes only whole-list reads and has no `after_seq` query or notification mechanism.
- Improvement path: Add a store query keyed by `(run_id, seq)` first; use a condition/pub-sub mechanism only if polling remains measurable after that change.

**Artifact lookup scans every run:**
- Problem: `/api/artifacts/{artifactId}/content` loops through all runs and loads each run's artifacts until it finds the ID.
- Files: `api/loopforge/app.py`, `api/loopforge/store.py`, `api/loopforge/sqlite_store.py`
- Cause: The Store protocol lacks `get_artifact(artifact_id)` even though SQLite already keys records by kind and ID.
- Improvement path: Add the direct lookup to both stores and call it from the endpoint.

**List endpoints deserialize entire resource collections:**
- Problem: Goals, runs, providers, datasets, templates, evaluators, gates, audit events, and many per-run collections are loaded and sorted in Python without pagination.
- Files: `api/loopforge/app.py`, `api/loopforge/sqlite_store.py`, `api/loopforge/store.py`
- Cause: The generic store exposes list-all operations and stores sortable fields inside JSON payloads.
- Improvement path: Add pagination and indexed columns when record counts become operationally significant; do not add a second database before SQLite contention is measured.

## Fragile Areas

**Run lifecycle state machine:**
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/agent_loop.py`, `api/loopforge/opencode_engine.py`
- Why fragile: Multiple request handlers and a stream thread mutate snapshots of the same run, while status transitions are not centralized or compare-and-set protected.
- Safe modification: Route every status transition through one store operation that validates the expected current status; add cooperative cancellation checks between turns before changing UI controls.
- Test coverage: `tests/test_runner.py` and `tests/test_run_gate_api.py` cover sequential states, but no test races active execution against pause/cancel or concurrent events.

**Sandbox and opencode boundary:**
- Files: `api/loopforge/providers.py`, `api/loopforge/opencode_config.py`, `api/loopforge/opencode_engine.py`, `docker/sandbox.Dockerfile`, `docker/opencode-sandbox.Dockerfile`
- Why fragile: Safety is the combination of generated permissions, Docker arguments, gVisor availability, mounted paths, DNS, network policy, image contents, and best-effort container cleanup.
- Safe modification: Preserve the fail-closed defaults and command-array construction; verify changes against both config-lockdown tests and an actual disposable gVisor environment.
- Test coverage: `tests/test_agent_engine.py`, `tests/test_providers.py`, `tests/test_docker_gvisor_provider.py`, and `tests/security/test_guardrails.py` mock Docker commands or SDK clients; no automated test launches the real images with `runsc` and validates egress/host isolation.

**Generic JSON persistence:**
- Files: `api/loopforge/sqlite_store.py`, `api/loopforge/domain.py`
- Why fragile: Database constraints cannot enforce domain references, status transitions, event sequence uniqueness, or payload compatibility.
- Safe modification: Keep store operations backward compatible, migrate existing JSON before changing required model fields, and make multi-record changes transactional.
- Test coverage: `tests/test_sqlite_store.py` covers reopen persistence and basic cascades but not migrations, concurrent writers, corruption recovery, or process-level contention.

**Output harvesting and result validation:**
- Files: `api/loopforge/runner.py`, `api/loopforge/evaluators.py`, `api/loopforge/opencode_engine.py`
- Why fragile: Agent-produced dictionaries are converted into strict result models later; malformed numeric fields can raise during results assembly, and correctness depends on evaluator behavior plus an agent-authored result contract.
- Safe modification: Validate harvested artifact metadata at write time and persist rejected candidates with explicit reasons instead of assuming later coercion succeeds.
- Test coverage: `tests/test_runner_agent_loop.py`, `tests/test_evaluators_api.py`, and `tests/test_plan5_api.py` cover deterministic fixtures but not adversarial malformed opencode result files across the full API path.

## Scaling Limits

**SQLite store:**
- Files: `api/loopforge/sqlite_store.py`, `api/loopforge/store.py`
- Current capacity: One process-local SQLite connection in WAL mode protected by one `RLock`; every record payload is JSON and every write commits immediately.
- Limit: Writes serialize within a process, multiple application processes do not share the Python lock, and long histories amplify full-list deserialization.
- Scaling path: Keep SQLite for single-node use; add atomic SQL operations, pagination, and busy-timeout handling first, then move to a server database only when multi-node execution is required.

**Dataset upload and profiling:**
- Files: `api/loopforge/app.py`, `api/loopforge/datasets.py`, `api/loopforge/settings.py`
- Current capacity: Configured upload content limit is 256 MiB by default; the complete request and CSV profile are handled synchronously in the API process.
- Limit: Peak memory exceeds the nominal file limit and concurrent uploads/profile jobs multiply it; Parquet has zero usable capacity.
- Scaling path: Proxy body limits plus streaming storage and queued profiling; install a Parquet reader only when Parquet is a required format.

**Run event streams:**
- Files: `api/loopforge/app.py`, `api/loopforge/sqlite_store.py`
- Current capacity: Each client polls at 10 Hz; file listings stop after 500 entries and text previews stop after 256 KiB.
- Limit: Event query and JSON-deserialization work grows with `connections × 10 × total_run_events`; file entries beyond 500 are silently absent from the UI.
- Scaling path: Query events after a sequence cursor, reduce/adapt polling, and paginate file listings if workspaces routinely exceed 500 visible files.

**Execution concurrency:**
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/providers.py`
- Current capacity: Each active run holds a request worker and starts local Docker/gVisor resources constrained per container to configured CPU and memory values.
- Limit: There is no global concurrency admission control, queue, recovery after API restart, or aggregate host CPU/memory budget.
- Scaling path: Add a small bounded worker queue and persisted leases before allowing untrusted multi-user concurrency.

## Dependencies at Risk

**`opencode-ai` alpha release:**
- Risk: The optional integration depends on `opencode-ai>=0.1.0a36` with no upper bound and uses a loosely typed SDK surface adapted through `_get()`.
- Impact: An alpha API or event-shape change can break session creation, event accounting, cancellation, or result harvesting.
- Migration plan: Pin a tested version in deployment artifacts and keep the compatibility seam in `api/loopforge/opencode_engine.py`; upgrade only with the fake-client suite plus one real-container smoke run.

**Unpinned backend environment and container tags:**
- Risk: `pyproject.toml` uses broad compatible ranges without a committed Python lockfile, while settings default to mutable `python:3.12-slim` and `loopforge/opencode-sandbox:latest` image tags.
- Impact: Rebuilds can change behavior or supply-chain inputs without a source change.
- Migration plan: Produce a deployment lock/constraints file and deploy images by digest when reproducible releases begin; retain broad library ranges for local development if desired.

**Frontend dependency concentration:**
- Risk: `reactflow` contributes a 153.92 kB built route chunk and the main bundle is 273.04 kB before gzip; the package is central to the builder UI.
- Impact: Builder changes can increase load cost and upgrades can affect graph behavior across `web/src/pages/LoopBuilderPage.tsx` and `web/src/components/run/AgentCanvas.tsx`.
- Migration plan: Keep the existing route-level lazy loading in `web/src/app/routes.tsx`; replace the library only if bundle or behavior measurements justify the rewrite.

## Missing Critical Features

**Production identity and tenant isolation:**
- Problem: There is no user identity, ownership field, session, API token, or authorization policy.
- Files: `api/loopforge/app.py`, `api/loopforge/domain.py`, `web/src/lib/api/client.ts`
- Blocks: Safe shared, remote, or multi-tenant deployment of goals, datasets, provider credentials, gates, artifacts, and runs.

**Durable run orchestration:**
- Problem: Runs are synchronous request work with no queue, lease, heartbeat, restart recovery, or cooperative cancellation.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/opencode_engine.py`
- Blocks: Reliable long-running execution, bounded host concurrency, real pause/cancel semantics, and recovery after process restarts.

**Operational observability:**
- Problem: The application prints resolved startup settings and persists domain events, but exposes no structured service logs, metrics, health/readiness endpoint, tracing, or error tracking.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/sqlite_store.py`
- Blocks: Diagnosing production latency, stuck containers, SQLite contention, provider failure rates, and budget overruns.

**Usable Parquet ingestion:**
- Problem: The API advertises and accepts Parquet but the runtime intentionally has no reader and marks every Parquet dataset failed.
- Files: `api/loopforge/app.py`, `api/loopforge/datasets.py`, `pyproject.toml`
- Blocks: Any workflow whose source dataset is available only as Parquet without an out-of-band conversion step.

## Test Coverage Gaps

**Budget enforcement:**
- What's not tested: `max_llm_calls` stopping provider calls, accurate cost tracking, and interaction between compaction calls and the budget.
- Files: `api/loopforge/domain.py`, `api/loopforge/runner.py`, `tests/test_runner.py`, `tests/test_runner_agent_loop.py`
- Risk: Expensive runs exceed declared limits unnoticed.
- Priority: High

**Active run lifecycle races:**
- What's not tested: Pause/cancel during an active native or opencode turn, state overwrite prevention, concurrent gate decisions, and event sequence uniqueness.
- Files: `api/loopforge/app.py`, `api/loopforge/runner.py`, `api/loopforge/sqlite_store.py`, `tests/test_run_gate_api.py`, `tests/test_agent_engine.py`
- Risk: A run shown as cancelled resumes or completes, or event consumers receive ambiguous ordering.
- Priority: High

**Real sandbox integration:**
- What's not tested: Launching the committed sandbox images under gVisor, confirming offline egress denial, validating online allowlist behavior, enforcing host-path isolation, and cleaning up after timeout/cancellation.
- Files: `api/loopforge/providers.py`, `api/loopforge/opencode_config.py`, `docker/sandbox.Dockerfile`, `docker/opencode-sandbox.Dockerfile`, `tests/security/test_guardrails.py`
- Risk: Mocked command assertions pass while the actual runtime is unavailable or less isolated than intended.
- Priority: High

**Authentication and SSRF protections:**
- What's not tested: There is no access-control layer or provider URL policy to exercise.
- Files: `api/loopforge/app.py`, `api/loopforge/providers.py`, `tests/security/test_guardrails.py`
- Risk: A future remote deployment exposes sensitive operations or internal network reachability by default.
- Priority: High

**Persistence evolution and concurrency:**
- What's not tested: Loading older payload versions, two process connections writing the same logical record/event stream, database busy handling, malformed JSON, and crash consistency across multi-record updates.
- Files: `api/loopforge/sqlite_store.py`, `tests/test_sqlite_store.py`
- Risk: Upgrades or concurrent deployments corrupt logical ordering or become unable to load stored state.
- Priority: Medium

**Upload streaming and format validity:**
- What's not tested: Rejecting a request before buffering it, multipart overhead beyond the content limit, malformed or spoofed Parquet input, and concurrent large uploads.
- Files: `api/loopforge/app.py`, `api/loopforge/datasets.py`, `tests/test_datasets_api.py`
- Risk: Memory exhaustion or misleading accepted-but-failed datasets.
- Priority: Medium

**Frontend quality gate:**
- What's not tested: The test/build commands do not enforce `npm run lint`, and the template-page test does not prevent hook-like names for ordinary handlers.
- Files: `web/src/pages/TemplatesPage.tsx`, `web/src/pages/TemplatesPage.test.tsx`, `web/package.json`
- Risk: CI can report tests/build green while static correctness checks fail.
- Priority: Medium

---

*Concerns audit: 2026-07-11*
