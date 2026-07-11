# LoopForge

## What This Is

LoopForge is a local-first platform for creating, approving, running, and inspecting bounded agent workflows. This milestone turns the existing React and FastAPI application into a polished, presenter-operated public showcase that uses real cloud-model calls and real Docker sandbox execution for goal-to-artifact, dataset-analysis, and software-task demonstrations.

The showcase is designed for a broad audience: it must be approachable enough for a first-time viewer while exposing events, budgets, evaluations, artifacts, and safety controls for technical scrutiny.

## Core Value

LoopForge must prove equally that real agent autonomy can be controlled, complex loops can be built without hand-coding orchestration, and the resulting work is genuinely useful.

## Requirements

### Validated

- ✓ Users can create goals, receive clarity checks, and generate loop specifications through an OpenAI-compatible model — existing
- ✓ Users can visually inspect and edit agent-loop graphs before approval — existing
- ✓ Users must explicitly approve a loop specification before execution — existing
- ✓ Approved loops can execute through native or optional opencode agent engines behind a shared runtime interface — existing
- ✓ Agent code can run through permissioned tools in Docker/gVisor-oriented sandbox adapters — existing
- ✓ Users can upload datasets, configure providers and evaluators, manage gates, and inspect run events, context, files, artifacts, and results — existing
- ✓ Durable local state is stored in SQLite, with in-memory adapters available for tests — existing
- ✓ Backend and frontend behavior is covered by pytest, Vitest, Testing Library, and contract/security checks — existing

### Active

- [ ] Provide three polished, repeatable real-demo paths: goal-to-artifact, real dataset analysis, and sandboxed software work
- [ ] Ensure every showcased result comes from a real configured cloud model and real sandbox execution, never seeded, mocked, precomputed, or fabricated demo data
- [ ] Make each demo understandable to a first-time viewer through clear onboarding, progress, approvals, outcomes, and recovery guidance
- [ ] Make agent control technically credible through enforceable step and LLM-call budgets, accurate reported usage, explicit gates, inspectable event history, and reliable cancellation
- [ ] Make cloud credentials safe for a presenter-operated local environment through secure configuration, masked output, and production-foot-gun removal
- [ ] Make Docker Desktop the reliable local execution target on the presenter's Mac while preserving fail-closed sandbox boundaries
- [ ] Produce genuine, verifiable artifacts and evaluations for all three demo paths, with errors surfaced honestly rather than replaced by success-shaped fallbacks
- [ ] Reach showcase quality across visual polish, responsive behavior, accessibility basics, empty/loading/error states, and consistent product language
- [ ] Provide a reproducible setup, presenter runbook, demo scripts that use real inputs, troubleshooting guidance, and public-facing project documentation
- [ ] Leave backend tests, frontend tests, frontend lint, production build, and focused real-runtime smoke checks passing

### Out of Scope

- Public hosting and anonymous visitor access — this milestone is a presenter-operated local showcase
- Accounts, teams, tenant isolation, and authorization for shared deployment — no multi-user service is being launched
- Abuse prevention and public usage quotas — viewers do not directly operate an internet-facing instance
- Distributed workers, multi-node scaling, and production orchestration infrastructure — local demo reliability is the target
- Mobile applications — the existing responsive web application is the presentation surface
- Fake samples, synthetic datasets presented as real, mocked model output, seeded run histories, and precomputed results — they would invalidate the core demonstration

## Context

The existing application is a two-process modular monolith: a React 19 and TypeScript frontend communicates with a FastAPI and Python 3.12 backend. It already supports goals, generated loop specs, visual loop editing, approvals, providers, datasets, evaluators, guarded runs, event streams, artifacts, results, SQLite persistence, and Docker-oriented sandbox execution.

The codebase map identifies several gaps that directly undermine a credible showcase. LLM-call budgets are counted but not enforced, cost remains unknown, pause/cancel cannot reliably interrupt active execution, runs block request workers, provider URLs and default secret configuration are unsafe outside trusted local use, Parquet is advertised without a usable reader, and frontend lint is not currently clean. Real sandbox behavior is primarily mock-tested rather than proven through an end-to-end Docker smoke path.

The intended presentation is local and guided by the project owner on a Mac. A real OpenAI-compatible cloud provider supplies model inference, and Docker Desktop supplies isolated execution. All three demo paths must run from genuine inputs during the presentation. The audience is broad, so the primary narrative and interface must remain accessible while detailed evidence remains available for developers and AI engineers.

## Constraints

- **Truthfulness**: No fake, mocked, seeded, or precomputed showcase outputs — public credibility depends on genuine execution
- **Runtime**: OpenAI-compatible cloud model plus Docker Desktop on macOS — this is the required presenter environment
- **Deployment**: Local, presenter-operated web application — public hosting is deliberately deferred
- **Architecture**: Preserve the established React/FastAPI, ports-and-adapters, SQLite, and typed API boundaries — reuse the working system instead of rebuilding it
- **Security**: Treat model credentials, uploaded data, generated output, file paths, and provider URLs as untrusted — real demonstrations must not weaken existing guardrails
- **Reliability**: Fail honestly and recover clearly when a provider, model, Docker, or generated task fails — fabricated success is prohibited
- **Quality**: Automated tests, lint, production build, and focused real-runtime smoke checks must pass before the showcase is considered complete
- **Scope**: Optimize for one reliable presenter and a broad viewing audience, not concurrent public users

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a polished showcase rather than a public beta or production SaaS | The immediate goal is credible public demonstration, not shared service operation | — Pending |
| Demonstrate goal-to-artifact, dataset analysis, and software work | Together they show generality and prevent the product from looking tailored to one staged task | — Pending |
| Require real inputs and live execution for every demo | Authenticity is central to the value proposition | — Pending |
| Run locally under presenter control | This avoids premature identity, tenancy, abuse, and hosting work while retaining a real product experience | — Pending |
| Use an OpenAI-compatible cloud model with Docker Desktop on macOS | This is the simplest reliable presenter setup and matches existing provider and sandbox seams | — Pending |
| Give control, usability, and useful outcomes equal weight | The showcase must satisfy both non-technical viewers and technical evaluators | — Pending |
| Defer multi-user production infrastructure | It does not improve the chosen local showcase outcome enough to justify its scope | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-11 after initialization*
