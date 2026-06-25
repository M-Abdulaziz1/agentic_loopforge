# LoopForge — PRD & System Design

> **Codename:** LoopForge (placeholder — rename freely).
> **One-liner:** A self-hostable playground for building *guarded-autonomy* agentic loops that connect to a database, profile and analyze the data, generate statistically-validated insights, and build/validate ML models — with a supervisor layer and human approval gates.
> **Audience for this doc:** Claude Code (build agent) + the human engineer reviewing its work.
> **Status:** Draft v1. Phase 1 is the buildable MVP; later phases are roadmap.

---

## 0. Read this first — design philosophy

This product is deliberately **not** "press a button and get a finished ML model autonomously." The current state of the art does not support that as a reliable promise: leading autonomous-ML agents medal in only ~17–40% of Kaggle-style tasks on curated benchmarks, and collapse to near-zero percentile on harder real-world domains — and those benchmarks feed *pre-cleaned* data, which overstates real performance. The failures come from missing scientific/engineering discipline, not from lack of compute.

So LoopForge is built on three non-negotiable principles:

1. **Guarded autonomy, not full autonomy.** The agent proposes and drafts; humans approve at defined gates; every expensive or irreversible step is gated or capped.
2. **Statistical discipline is a first-class component, not a prompt.** Insights must pass validation (significance, effect size, leakage checks). Models must beat a trivial baseline on a held-out set or they are rejected.
3. **Security by construction.** The agent writes and runs untrusted code. Treat all generated code as adversarial. Everything executes in an isolated sandbox with no general internet, a read-only database, and a package allowlist.

If Claude Code is ever tempted to "simplify" by removing a guardrail (run code on the host, give the DB write access, allow open `pip install`, skip the HITL gate, let the loop run uncapped) — **do not.** Those guardrails are the product.

---

## 1. Problem & goals

### 1.1 Problem
Data teams spend enormous effort on the repetitive front half of analysis — connecting to data, profiling it, forming hypotheses, running EDA, drafting candidate models. Existing visual agent builders (Langflow, Flowise, Dify) solve generic LLM-workflow orchestration but not *disciplined autonomous data science*, and the autonomous-DS research scaffolds (AIDE, R&D-Agent, Data Interpreter) are not productized, not self-hostable for sovereign data, and have no guardrails or human-gate layer.

### 1.2 Goals (what success looks like)
- A user defines a **goal** in natural language over a **data source**, and the platform runs a **loop** that returns: (a) a small set of *validated* insights, and (b) one or more *validated* candidate ML models — or an honest "nothing significant found."
- Every run is **traceable, reproducible, budget-capped, and human-gated**.
- The whole thing runs **on-prem / air-gappable** on the user's own Kubernetes infra (RKE2 / DGX) with a **configurable LLM backend** including a local vLLM endpoint.

### 1.3 Non-goals (explicitly out of scope, at least for MVP)
- Full unattended autonomy with no human in the loop.
- Arbitrary internet access or open package installation from public PyPI.
- Non-tabular data (images, audio, free-text corpora) in MVP — tabular only first.
- Model **serving/deployment** — MVP produces a model artifact + report, not a live endpoint.
- Streaming / real-time data sources — batch snapshots only in MVP.

### 1.4 Primary user & differentiation
- **Primary user (MVP):** a data scientist or analyst who wants an accelerator with control.
- **Wedge:** sovereign, self-hosted, Arabic-capable, PDPL-aware, running on the customer's own GPU infra — defensible vs. US SaaS playgrounds that require data egress to the cloud.

---

## 2. Core concepts / domain model (glossary)

| Concept | Meaning |
|---|---|
| **Project** | A workspace pairing a *goal* with a *data source* and *constraints/budget*. |
| **Data Source** | A read-only connection (Postgres in MVP) exposed to the agent via a read-only MCP server. |
| **Loop / Run** | One execution of the agentic graph for a project. Has a budget, a status, a trace, and artifacts. |
| **Node / Step** | A stage in the loop (profile, EDA, insight, validate, model, supervisor, gate, report). |
| **Insight** | A claim about the data + its supporting evidence + the statistical test that validated (or rejected) it. |
| **Model Artifact** | A trained model + its validation scheme, metrics, baseline comparison, and leakage report. |
| **Supervisor Review** | A multi-judge evaluation scoring business relevance + technical quality of insights/models. |
| **HITL Gate** | A pause point where a human must approve/reject before the loop continues. |
| **Budget** | Hard caps: max iterations, max USD (LLM + compute), max wall-clock. The loop *must* terminate when any is hit. |

---

## 3. Functional requirements

IDs are stable so Claude Code can reference them in commits/tests.

### 3.1 Data sources & connection
- **FR-DS-1** Create a Postgres data source with host/port/db/user; secret stored encrypted (never in plaintext, never in logs).
- **FR-DS-2** "Test connection" validates reachability and that the credential is **read-only** (reject if it can write/DDL — verify via `has_table_privilege`/role inspection).
- **FR-DS-3** The agent accesses data **only** through a read-only MCP server bound to that credential. No direct DB driver access from agent code.
- **FR-DS-4** Profiling masks/avoids emitting raw PII values into traces or LLM context (see FR-SEC-6).

### 3.2 Project & run lifecycle
- **FR-RUN-1** Create a project: goal (text), data source, optional constraints, budget (iterations/USD/wall-clock).
- **FR-RUN-2** Start a run → returns a run id; run executes asynchronously (job queue).
- **FR-RUN-3** Stream live progress (node transitions, tool calls, partial outputs, cost spent) via SSE/WebSocket.
- **FR-RUN-4** A run ends in one of: `completed`, `completed_no_findings`, `rejected_by_human`, `budget_exhausted`, `failed`, `cancelled`. Status must always be explainable.
- **FR-RUN-5** Cancel a running loop at any time; in-flight sandbox is torn down.

### 3.3 The loop (agent graph)
- **FR-LOOP-1 Plan:** decompose the goal into an analysis plan; bind it to the actual data schema.
- **FR-LOOP-2 Profile:** via MCP, retrieve schema + compute profiling stats (row counts, null %, cardinality, dtypes, basic distributions) — computed *in the sandbox*, not by trusting the LLM.
- **FR-LOOP-3 EDA & hypotheses:** generate candidate hypotheses grounded in the profile.
- **FR-LOOP-4 Insight generation:** produce candidate insights, each as a falsifiable claim.
- **FR-LOOP-5 Insight validation (mandatory):** each candidate insight is tested in the sandbox with an appropriate statistical test; record test, p-value/effect size, sample size. Apply multiple-comparison correction. **Reject** insights that don't pass. An unvalidated insight must never reach the final report.
- **FR-LOOP-6 Model proposal:** propose ≤N candidate modeling approaches appropriate to the target/data (MVP: tabular regression/classification via sklearn/xgboost/lightgbm/statsmodels).
- **FR-LOOP-7 Model build & validate (mandatory checks):** write + run training code in the sandbox using a proper validation scheme (k-fold or train/val/test); run a **leakage check** and a **baseline comparison** (model must beat a naive baseline — mean/mode/most-frequent — on held-out data). Reject models that fail.
- **FR-LOOP-8 Supervisor review:** a multi-judge step scores each surviving insight/model on (business relevance, technical soundness, novelty). Low-scoring items are dropped or routed back for one more iteration (within budget).
- **FR-LOOP-9 HITL gate:** at configured gate points the loop pauses and waits for human approve/reject (default gates: before model training, before finalizing the report).
- **FR-LOOP-10 Report:** compile a clear, simple results view (top insights, models with metrics vs. baseline, plots) with full **drill-down** into the underlying steps, code, and traces.
- **FR-LOOP-11 Budget guard:** before each expensive node, check budget; if any cap is hit, stop gracefully and finalize with whatever is validated so far.
- **FR-LOOP-12 Honest empty result:** if nothing passes validation, return `completed_no_findings` with an explanation — never fabricate findings.

### 3.4 Supervisor
- **FR-SUP-1** Supervisor uses **≥2 judges** (different models or different prompts/seeds) and aggregates; a single LLM verdict is not authoritative.
- **FR-SUP-2** Supervisor scores against an explicit rubric with chain-of-thought; rubric is versioned.
- **FR-SUP-3** The *final* "is this business-important?" decision is a **human** sign-off (HITL gate), not the LLM judges alone. Judges triage/rank; humans confirm.

### 3.5 Human-in-the-loop
- **FR-HITL-1** A "gate inbox" lists pending approvals across runs.
- **FR-HITL-2** Each gate shows the context needed to decide (what's about to happen, cost estimate, what was found so far).
- **FR-HITL-3** Approve / reject / approve-with-note; rejection ends or redirects the run per gate type.
- **FR-HITL-4** Gates time out per project config (default: pause indefinitely; configurable auto-reject).

### 3.6 Observability & reproducibility
- **FR-OBS-1** Every LLM call, tool call, and node transition is traced (Langfuse), with token + USD cost.
- **FR-OBS-2** Append-only event log per run; the run is reconstructable from it.
- **FR-OBS-3** Artifacts (code, insights, models, plots, report) are versioned and linked to the run + data snapshot reference (lineage).
- **FR-OBS-4** Re-running a project records a new run; runs are diffable at the summary level.

### 3.7 Visual loop builder (Phase 3)
- **FR-UI-1** Drag-and-drop canvas (React Flow) to compose/edit a loop from typed nodes.
- **FR-UI-2** Node config panels; validation of graph (no dangling required inputs).
- **FR-UI-3** Save loop templates; instantiate a run from a template.

---

## 4. Non-functional requirements

- **NFR-1 Self-hostable / air-gappable:** docker-compose for dev; Helm chart for RKE2 in prod. Must run with **zero external SaaS** when configured for air-gap (local LLM via vLLM, internal package mirror, self-hosted Langfuse/MinIO).
- **NFR-2 Configurable LLM backend:** provider abstraction supporting Anthropic API (`claude-opus-4-8` for planning/supervision, `claude-sonnet-4-6` for code-gen by default) **and** an OpenAI-compatible endpoint (the user's local vLLM on B300). Provider/model selectable per project.
- **NFR-3 Security:** see §6 — this is the dominant NFR.
- **NFR-4 Cost control:** no run can exceed its budget caps. Global org-level cap as a backstop.
- **NFR-5 PDPL-aware:** PII detection + masking in profiling; configurable data-retention; audit log of who accessed/approved what.
- **NFR-6 Multi-tenant-ready (later):** data model carries `org_id`/`workspace_id` from day one even if auth is single-tenant in MVP.
- **NFR-7 Observability:** p95 node-level tracing; live cost meter visible in the run view.

---

## 5. System architecture

### 5.1 Components
```
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend (React + TS + Vite + Tailwind + shadcn/ui + React Flow)      │
│  - Projects / Data sources / Run view (live trace + DAG) / Gate inbox │
│  - Results & drill-down report                                        │
└───────────────▲───────────────────────────────────┬──────────────────┘
                │ REST + SSE/WS                      │
┌───────────────┴───────────────────────────────────▼──────────────────┐
│ API service (FastAPI, Python)                                         │
│  - Project/run/datasource/gate endpoints                             │
│  - Auth, RBAC stub, audit log                                        │
│  - Enqueues runs                                                     │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │                                    │
        ┌───────▼─────────┐                  ┌───────▼───────────────┐
        │ Postgres (meta) │                  │ Redis + Celery        │
        │ projects/runs/  │                  │ (run job queue)       │
        │ artifacts/gates │                  └───────┬───────────────┘
        └─────────────────┘                          │
                                          ┌───────────▼─────────────────┐
                                          │ Loop Worker (LangGraph)      │
                                          │  - State machine / nodes     │
                                          │  - Budget guard, HITL interrupt│
                                          │  - Supervisor (multi-judge)  │
                                          └──┬─────────────┬─────────────┘
                                             │             │
                            ┌────────────────▼──┐     ┌────▼───────────────┐
                            │ LLM Provider       │     │ Sandbox Provider    │
                            │  - Anthropic       │     │  - Docker+gVisor    │
                            │  - vLLM (OpenAI-cmp)│    │    (self-host) /E2B │
                            └────────────────────┘     │  - no internet      │
                                                       │  - read-only root   │
                                                       │  - pkg allowlist    │
                                                       │  - resource/time cap│
                                                       └────┬───────────────┘
                                                            │ (only) egress to:
                                          ┌─────────────────▼──────────────┐
                                          │ Read-only MCP DB server         │
                                          │  + internal PyPI mirror         │
                                          └─────────────────────────────────┘

   Cross-cutting: Langfuse (tracing), MinIO/S3 (artifact storage), Vault/KMS (secrets)
```

### 5.2 Tech stack (opinionated defaults — Claude Code may justify swaps but not silently drop guardrails)
- **Frontend:** React + TypeScript, Vite, Tailwind, shadcn/ui, React Flow, TanStack Query, Zustand.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy + Alembic.
- **Orchestration:** LangGraph (stateful, cyclic graph; native `interrupt()` for HITL; supervisor pattern).
- **Agent engine:** custom LangGraph nodes; you may borrow design patterns from open scaffolds (AIDE / Data Interpreter / R&D-Agent) but the validation + guardrail layers are bespoke.
- **Jobs:** Celery + Redis.
- **Sandbox:** abstraction with two providers — `DockerGvisorSandbox` (self-host default, `runsc` runtime) and `E2BSandbox` (cloud alt).
- **DB connection:** read-only MCP server (Postgres) — separate process the sandbox can reach; agent never imports a DB driver directly.
- **Package supply:** internal PyPI mirror (devpi/bandersnatch) + allowlist; sandbox has **no** public internet.
- **Metadata DB:** Postgres. **Object storage:** MinIO (S3-compatible). **Secrets:** Vault or cloud KMS; dev fallback = encrypted column with a KMS-backed key (never plaintext).
- **Observability:** Langfuse (self-hosted).
- **LLM:** Anthropic API + OpenAI-compatible (vLLM) behind one interface.

### 5.3 LangGraph state (reference shape)
```python
class LoopState(TypedDict):
    run_id: str
    goal: str
    constraints: dict
    datasource_id: str
    plan: list[Step]
    data_profile: dict            # computed in sandbox, PII-masked
    hypotheses: list[Hypothesis]
    candidate_insights: list[Insight]
    validated_insights: list[Insight]      # only statistically-passed
    model_candidates: list[ModelCandidate]
    trained_models: list[ModelArtifact]    # only baseline-beating, leakage-clean
    supervisor_reviews: list[Review]
    budget: Budget                # {max_iters, max_usd, max_wallclock, spent_*}
    iteration: int
    status: RunStatus
    pending_gate: Gate | None
    scratchpad: list[Message]
    error: str | None
```

### 5.4 Node graph (edges)
```
plan → profile → eda → insight_gen → insight_validate
   → [gate: before_training] → model_propose → model_build → model_eval
   → supervisor_review → [gate: before_finalize] → report → END

Conditional/back edges (each guarded by iteration & budget caps):
  insight_validate → eda            (if too few validated insights, retry once)
  model_eval → model_propose        (if no model beats baseline, retry once)
  supervisor_review → insight_gen/model_propose (if low scores, one refinement pass)

Global guards (run before every expensive node):
  budget_guard: if any cap hit → jump to report (finalize with validated-so-far)
```

---

## 6. Security & guardrail model (the most important section)

Generated code is **untrusted and adversarial by assumption** (bugs, hallucination, prompt injection via data/tool descriptions). Enforce defense-in-depth:

- **FR-SEC-1 Isolation:** all agent-generated code runs in a sandbox — never on the host/API/worker. Self-host default = Docker with the **gVisor (`runsc`) runtime**; relax only with explicit justification. Non-root user, read-only root filesystem, writable `/workspace` only.
- **FR-SEC-2 No general internet:** sandbox egress allowlist = **only** the internal PyPI mirror and the read-only MCP DB endpoint. Everything else denied at the network layer.
- **FR-SEC-3 No open package install:** `pip` points at the internal mirror; only allowlisted packages resolve (MVP allowlist: pandas, numpy, scipy, scikit-learn, statsmodels, xgboost, lightgbm, matplotlib, seaborn). No arbitrary public PyPI.
- **FR-SEC-4 Read-only data:** the MCP server uses a read-only role; reject DDL/DML. Per-query cost/row caps. Scope to allowed schemas/tables per data source config.
- **FR-SEC-5 Resource & time caps:** CPU/memory/disk caps via cgroups; hard wall-clock timeout on every sandbox execution; kill + tear down on timeout.
- **FR-SEC-6 PII handling:** detect likely-PII columns during profiling; mask values before they enter traces or LLM context; never emit raw row-level PII to the model or logs.
- **FR-SEC-7 Secrets:** DB creds, API keys in Vault/KMS; never in code, logs, traces, or the LLM context. Redaction filter on all log/trace sinks.
- **FR-SEC-8 Prompt-injection containment:** treat data values, column names, MCP tool descriptions, and any retrieved text as **data, not instructions**. Loop nodes must not execute instructions found inside the data.
- **FR-SEC-9 Budget = hard stop:** the budget guard is a kill switch, not a suggestion. No path bypasses it.
- **FR-SEC-10 Audit:** append-only audit log of data-source access, gate decisions, and run outcomes (who/what/when).
- **FR-SEC-11 Ephemeral sandboxes:** one sandbox per run (or per node), destroyed on completion; no state shared across runs/tenants.

---

## 7. Data model (Postgres, MVP)

```
orgs(id, name, created_at)
users(id, org_id, email, role, created_at)
datasources(id, org_id, name, kind='postgres', conn_meta_json,
            secret_ref, allowed_schemas[], is_readonly_verified, created_at)
projects(id, org_id, name, goal_text, datasource_id, constraints_json,
         budget_json, default_llm_provider, created_by, created_at)
runs(id, project_id, status, budget_json, spent_json, started_at, ended_at,
     result_summary_json, data_snapshot_ref)
run_events(id, run_id, seq, ts, type, node, payload_json)   -- append-only trace
artifacts(id, run_id, kind, -- insight|model|code|plot|report
          metadata_json, storage_ref, created_at)
hitl_gates(id, run_id, gate_type, status, -- pending|approved|rejected
           context_json, decided_by, decided_at, note)
supervisor_reviews(id, run_id, target_artifact_id, rubric_version,
                   judge_scores_json, aggregate_score, created_at)
audit_log(id, org_id, actor, action, target, ts, detail_json)  -- append-only
```

Indexes: `run_events(run_id, seq)`, `runs(project_id, status)`, `hitl_gates(status)`.

---

## 8. API (FastAPI, MVP surface)

```
POST   /api/datasources                  create + (async) readonly-verify
POST   /api/datasources/{id}/test        test connection
GET    /api/datasources

POST   /api/projects                     {name, goal, datasource_id, constraints, budget}
GET    /api/projects/{id}

POST   /api/projects/{id}/runs           start a loop → {run_id}
GET    /api/runs/{id}                     status + summary
GET    /api/runs/{id}/events             SSE stream of run_events
POST   /api/runs/{id}/cancel
GET    /api/runs/{id}/artifacts

GET    /api/gates?status=pending          gate inbox
POST   /api/gates/{id}/decision           {decision: approve|reject, note?}
```
- SSE event types: `node_start`, `node_end`, `tool_call`, `llm_call`, `cost_update`, `gate_pending`, `run_status`.
- All mutating endpoints write to `audit_log`.

---

## 9. Frontend (MVP screens)
1. **Data Sources** — add/test a Postgres source; shows read-only-verified badge.
2. **Projects** — create project (goal + source + budget); list with last-run status.
3. **Run view** — live: node DAG with current node highlighted, streaming trace, **cost meter vs. budget**, cancel button.
4. **Gate inbox** — pending approvals with decision context + cost estimate.
5. **Results / report** — top validated insights (claim + test + p-value/effect size), models (metric vs. baseline, leakage status), plots, and **drill-down** into code + trace per item. Clear empty-state for `completed_no_findings`.

---

## 10. Phased build plan (for Claude Code)

### Phase 0 — Foundation
- Monorepo (`/api`, `/worker`, `/web`, `/mcp`, `/infra`), docker-compose, Postgres + Alembic, FastAPI skeleton + health, basic auth, audit log, **LLM provider abstraction** (Anthropic + vLLM), **Sandbox provider abstraction** (DockerGvisor first), Langfuse wiring.
- **Done when:** a "hello" node can run trivial code in the sandbox with no host/network access, and an LLM call is traced in Langfuse.

### Phase 1 — MVP "Guided Loop" (insights only)
- Read-only MCP Postgres server + readonly verification (FR-DS-2).
- LangGraph loop: plan → profile → eda → insight_gen → insight_validate → gate(before_finalize) → report. **No model building yet.**
- Statistical validation (FR-LOOP-5) with multiple-comparison correction.
- Budget guard + termination + honest empty result.
- SSE run view, gate inbox, results UI with drill-down.
- Package allowlist enforced; sandbox egress allowlist enforced; PII masking in profiling.
- **Done when:** on a bundled sample dataset loaded into Postgres, a run produces only validated insights or an honest `completed_no_findings`, fully traced, within budget, with a working HITL gate. Includes a **sandbox-escape test** and a **budget-cap test**.

### Phase 2 — Model building + Supervisor
- Add model_propose → model_build → model_eval with CV + **leakage check** + **baseline comparison** (FR-LOOP-7).
- Multi-judge supervisor (FR-SUP-1..3) + `before_training` gate.
- Model registry (artifacts), richer report, run DAG visualization.
- **Done when:** a model is only surfaced if it beats baseline on held-out data and passes leakage checks; supervisor scores are shown; human sign-off required for "business-important."

### Phase 3 — Visual loop builder + extensibility
- React Flow canvas, typed nodes, graph validation, templates.
- Guarded web-search node (allowlisted domains, results treated as data); expand package allowlist via mirror; multi-datasource.

### Phase 4 — Sovereign hardening
- Helm charts for RKE2; air-gap mode (local vLLM + internal mirror + self-hosted everything); PII/PDPL retention controls; full audit; gVisor enforced; load/perf pass.

---

## 11. Acceptance criteria & testing
- **Unit:** providers (LLM, sandbox), budget guard, statistical validators, leakage check, baseline comparator.
- **Integration:** full Phase-1 loop on a bundled CSV→Postgres fixture, asserting (a) only validated insights surface, (b) trace completeness, (c) budget never exceeded, (d) gate blocks finalize until approved.
- **Security tests (must pass):**
  - Sandbox cannot reach the internet (only mirror + MCP).
  - Sandbox cannot read the host filesystem or escape root FS.
  - DB credential cannot write/DDL.
  - `pip install <non-allowlisted>` fails.
  - Raw PII never appears in traces/logs/LLM context.
  - A run that tries to exceed budget is force-finalized.
- **Eval harness:** a small suite of fixture datasets with known ground-truth signals (and a known *no-signal* dataset) to verify the loop finds real signal and correctly returns empty on noise.

---

## 12. Risks → mitigations (carry into the build)
| Risk | Mitigation |
|---|---|
| Over-promising autonomy (capability ceiling) | Guarded autonomy + HITL gates + honest empty result. |
| Spurious "insights" (p-hacking, multiple comparisons) | Mandatory validation node + correction + effect-size thresholds. |
| Models that look good but leak / overfit | Leakage check + baseline comparison + held-out validation, enforced in code. |
| Supervisor (LLM judge) bias / drift / verbosity bias | Multi-judge consensus + rubric + human final sign-off; never trust one verdict. |
| Sandbox escape / malicious generated code | gVisor microVM-grade isolation, non-root, RO FS, no internet, resource/time caps. |
| Supply-chain (malicious packages) | Internal mirror + allowlist; no public PyPI. |
| Data exfiltration / DB damage | Read-only MCP, scoped schemas, query caps, PII masking. |
| Runaway cost / infinite loop | Hard budget caps + budget guard kill switch + iteration caps. |
| Prompt injection via data/tool descriptions | Treat all tool/data text as data, not instructions. |

---

## 13. Open decisions for the human (flag, don't guess)
1. Self-host sandbox (gVisor) vs. E2B as default — affects air-gap story.
2. Default judge models (two Claude prompts/seeds vs. Claude + local vLLM) for the supervisor.
3. Auth/RBAC depth for MVP (single-tenant vs. multi-workspace now).
4. Which sample/fixture datasets to bundle for tests + demo.
5. Product name + Arabic UI scope (RTL, bilingual) — Phase 1 or later.