# LoopForge Generic Loop Maker Foundation Design

Date: 2026-06-25

## Summary

LoopForge is a generic agent-loop creation and management platform. A user describes an end goal, configures runtime toggles, and LoopForge decides whether the goal is clear enough to turn into an executable agent loop. If the goal is unclear, the loop-maker asks focused clarification questions while maintaining a structured missing-requirements panel. Once the goal is clear, it generates a loop specification with agents, roles, system prompts, tools, handoffs, validation checks, approval gates, budgets, context strategy, and improvement rules.

The first milestone builds the generic loop-maker foundation. Data analysis and ML are treated as future templates or example loops, not as the product's core identity.

## Approved Scope

The first milestone includes:

- Goal creation with toggles for internet access, code sandbox access, local/offline mode, tool/connectors, and budget limits.
- A loop-maker that checks goal clarity before generating a loop.
- Hybrid clarification: chat-style questions plus a structured missing-requirements panel.
- Generated loop specs containing agents, prompts, tools, handoffs, gates, success criteria, failure criteria, budget policy, context policy, and improvement strategy.
- User review and approval before a generated loop spec runs.
- A loop runner that streams progress, tool calls, artifacts, context-pack sizes, token/cost estimates, errors, gates, and final status.
- Context and memory management so agents do not overload LLM context windows.
- Docker plus gVisor sandbox execution for generated or agent-authored code.
- Offline-local operation with a local OpenAI-compatible LLM endpoint.
- Optional online-enabled mode when the user enables the internet toggle for a goal.

Out of scope for this milestone:

- Full marketplace or public template ecosystem.
- Advanced visual canvas for manual graph editing.
- Deep multi-tenant RBAC.
- Production Helm/RKE2 packaging.
- Domain-specific ML validation and model registry.
- Arabic/RTL UI polish.

## Runtime Modes

LoopForge supports two explicit modes per goal.

### Offline Local

The offline-local mode is the default target. It must run without external SaaS.

Required properties:

- Local OpenAI-compatible LLM endpoint configured through environment variables.
- Local API, worker, web app, metadata database, Redis, and supporting services.
- Docker plus gVisor sandbox for code execution.
- Managed local workspace and local connectors only. The managed workspace is mounted into the sandbox with explicit permissions; it does not imply arbitrary host filesystem access.
- No internet tools available to generated agents.
- Local or no-op tracing/artifact implementations for the first milestone.

### Online Enabled

The online-enabled mode uses the same local foundation, but the user's internet toggle allows approved browser, search, or API tools.

Required properties:

- Internet access is a goal-creation toggle.
- The loop-maker adapts generated agents and tools to the internet setting.
- Run events record internet tool usage, accessed targets, and the reason for access.
- Agents cannot silently escalate from offline-local to online-enabled.

## Goal and Loop Creation Flow

The runtime flow is:

```text
goal_create
-> clarity_check
-> clarification_loop_if_needed
-> loop_spec_generate
-> user_review_gate
-> run_loop
-> evaluate_result
-> improve_or_finalize
```

The loop-maker first determines whether the user's goal is actionable. If required information is missing, the system asks one focused question at a time and updates the missing-requirements panel. When the goal is clear, the loop-maker generates a loop spec.

Before execution, the user reviews the generated loop spec. The preview must show:

- Agent names and responsibilities.
- System prompts or prompt summaries.
- Tool permissions.
- Handoffs and control flow.
- Success and failure criteria.
- Budget caps.
- Context policy.
- Approval gates.
- Improvement strategy.

The user can approve, reject, or edit the loop spec before running it.

## Architecture

The repository is a monorepo.

### `api`

FastAPI service for:

- Goals.
- Clarification sessions.
- Loop specs.
- Runs.
- Server-sent events.
- Artifacts.
- Gates.
- Context ledger records.
- Audit log.

### `worker`

Background execution service for:

- Goal clarity evaluation.
- Clarification question generation.
- Loop spec generation.
- Agent-loop execution.
- Improvement cycles.
- Budget checks.
- Human approval gates.
- Event emission.

### `sandbox`

Sandbox provider package for untrusted code execution.

The first provider is Docker plus gVisor (`runsc`). Generated code and agent-authored code never run on the host.

### `tools`

Tool registry and adapters for:

- Local filesystem workspace.
- Code sandbox execution.
- Browser/search/API tools for online-enabled goals.
- User-configured connectors.
- MCP-style tools.

Tools are permissioned by goal toggles and loop-spec rules.

### `web`

React/Vite application for:

- Goal creation.
- Runtime toggles.
- Clarification chat.
- Missing-requirements panel.
- Generated loop preview.
- Run monitor.
- Gate inbox.
- Artifacts and results.
- Context and memory visibility.

### `infra`

Docker compose for local development:

- API.
- Worker.
- Web.
- Metadata database.
- Redis.
- Sandbox support.
- Local package allowlist or local package mirror for sandbox dependencies.
- Local OpenAI-compatible LLM endpoint configuration.
- Optional local service stubs.

### `tests`

Unit, integration, and security tests for loop creation, execution, sandboxing, permissions, budgets, and context compaction.

## Core Interfaces

### `LLMProvider`

Abstracts model calls. The primary target is a local OpenAI-compatible endpoint. A deterministic fake provider is required for tests.

### `SandboxProvider`

Runs untrusted code through Docker plus gVisor. It enforces working-directory isolation, resource limits, timeouts, and network policy.

### `ToolProvider`

Defines tool metadata, permissions, execution behavior, audit fields, and whether a tool is available in offline-local or online-enabled mode.

### `ContextManager`

Builds bounded context packs for each LLM call from the raw context ledger, summaries, artifacts, tags, and current task.

### `LoopPlanner`

Performs clarity checks, asks clarification questions, and generates loop specs.

### `LoopRunner`

Executes approved loop specs, manages handoffs, emits events, checks budgets, and triggers improvement or finalization.

## Context and Memory Management

Context management is a first-class subsystem. Agents must not blindly append all prior messages and tool outputs until the LLM context window fails.

### Context Ledger

The context ledger is an append-only record of:

- User goals.
- Clarification questions and answers.
- Loop specs and versions.
- Agent messages.
- Tool calls and outputs.
- Artifacts.
- Gate decisions.
- Errors.
- Summaries.
- Final results.

Raw ledger entries are preserved for auditability and replay.

### Context Packs

Before each LLM call, the `ContextManager` builds a bounded context pack for the specific agent and task. A context pack can include:

- Goal summary.
- Approved loop spec.
- Relevant constraints.
- Current task.
- Recent events.
- Selected artifacts.
- Durable summaries.
- Open decisions.
- Tool permission rules.

The context pack must include token estimates and must respect per-agent and per-call token budgets.

### Token Estimation

The first implementation should use a tokenizer adapter per model family when available and a conservative fallback estimator when an exact tokenizer is not configured. Token estimates are recorded in run events so users can see when compaction or retrieval decisions were made.

### Compaction

When a run grows beyond configured thresholds, the system compacts older history into durable summaries. Compaction must preserve:

- User intent.
- Approved requirements.
- Important decisions.
- Open tasks.
- Tool outputs that affect future behavior.
- Errors and failed attempts.
- Links to raw events and artifacts.

The system should compact working memory, not erase the audit log.

### Retrieval

The first milestone uses simple retrieval based on tags, artifact types, agent names, and keyword matching. This gives agents a way to pull relevant prior context without loading the entire run.

### Failure Behavior

If the context manager cannot build a safe context pack within budget, the run must pause or fail explicitly with a context error. It must not silently drop critical requirements or continue with an unsafe prompt.

## Guardrails

The first milestone includes these guardrails:

- Generated code never runs on the host.
- Code execution uses Docker plus gVisor.
- Sandbox dependencies come only from an allowlist or local package mirror.
- Tools are permissioned by goal toggles and loop-spec rules.
- Agents cannot grant themselves internet, filesystem, connector, or code execution access.
- Internet access requires the goal's internet toggle.
- Offline-local goals cannot use internet tools.
- Every expensive or risky step checks budget and permissions first.
- Human approval is required before running a generated loop spec.
- Human approval is required before major tool-permission escalation.
- All raw events are preserved in the context ledger.
- LLM calls receive bounded context packs, not unbounded history.
- Unsafe requests stop with an explicit `unsafe_request` status.

## Data Model

Initial metadata records:

### `goals`

Stores user goal text, toggles, constraints, budget, runtime mode, and status.

### `clarification_sessions`

Stores generated questions, user answers, missing requirements, clarity score, and status.

### `loop_specs`

Stores generated agents, prompts, tools, handoffs, gates, success criteria, failure criteria, context policy, improvement strategy, and version.

### `runs`

Stores execution status, active loop spec version, budget, spend, started timestamp, ended timestamp, and result summary.

### `run_events`

Append-only stream of agent steps, tool calls, context-pack metadata, token estimates, gates, artifacts, errors, and status changes.

### `artifacts`

Stores files, reports, code, tool outputs, summaries, and final results.

### `context_entries`

Stores raw ledger entries, compacted summaries, retrieval tags, and links to source events or artifacts.

### `gates`

Stores pending, approved, and rejected human decisions.

### `audit_log`

Append-only user and system actions.

## Statuses and Error Handling

Supported statuses:

- `completed`: goal reached.
- `needs_clarification`: goal cannot be safely turned into a loop yet.
- `blocked`: missing permission, connector, tool, human input, or external prerequisite.
- `budget_exhausted`: budget cap reached.
- `failed`: unrecoverable runtime failure.
- `cancelled`: user cancelled the run.
- `unsafe_request`: request or generated plan violates safety or permission rules.
- `context_overflow`: the context manager cannot build a safe prompt within the configured token budget.

Tool failures should be recoverable when the loop can revise its approach within budget. If recovery is not possible, the run must stop with a clear failure reason.

## Testing Strategy

Required tests for the first milestone:

- Clarity checks classify clear and unclear goals.
- Clarification sessions ask focused questions and update missing requirements.
- Generated loop specs pass schema and permission validation.
- Tool permission enforcement blocks unauthorized tools.
- Offline-local mode refuses internet tools.
- Online-enabled mode audits internet tool usage.
- Docker plus gVisor sandbox executes allowed code.
- Generated code cannot run on the host.
- Sandbox resource limits and timeouts are enforced.
- Budget checks stop expensive or risky steps.
- Context packs respect token budgets.
- Compaction preserves important decisions and links to raw ledger entries.
- End-to-end goal-to-run flow works with deterministic fake LLM responses.

## Implementation Notes

The existing `Claude.MD` and `Loopforge_prd_and_system_design.MD` describe a data-science-focused version of LoopForge. This design supersedes that product scope for the first milestone. Data-science and ML loops can be reintroduced later as templates built on top of the generic loop-maker foundation.

The initial implementation should not remove the original docs. They remain useful as a domain template and as a source of guardrail ideas, especially around sandboxing, budgets, local/offline operation, auditability, and honest failure states.
