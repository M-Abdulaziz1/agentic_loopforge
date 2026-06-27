# LoopForge Frontend Design

Date: 2026-06-26

## Summary

This spec defines the LoopForge web frontend: a self-hostable control surface for
creating, reviewing, running, and supervising guarded-autonomy agent loops. The
product is a generic loop-maker (per
[2026-06-25-generic-loop-maker-foundation-design.md](2026-06-25-generic-loop-maker-foundation-design.md)):
a user describes a goal, LoopForge checks clarity and clarifies if needed,
generates a reviewable loop spec (agents, tools, handoffs, gates, budgets,
policies), and — after human approval — runs the loop in a sandbox while the user
watches agents work, approves gates, and reads validated results.

The frontend is wired to the live FastAPI service. Where the current API does not
yet expose data a screen needs, this spec lists the endpoints the frontend
requires; those are built alongside the UI.

The design language is **Holographic Glass**: a near-black violet→teal field with
frosted translucent panels, soft glow, and depth. The hero Run view is an
**agent canvas** — a node graph of agents with live handoffs — plus a per-agent
inspector and budget meters. The guardrails are surfaced visually everywhere
(read-only badges, denied tools, budget kill-switch framing, honest-empty states,
PII/overflow guards), consistent with the project principle that the guardrails
are the product.

Approved visual reference mockups live in
`.superpowers/brainstorm/` (gitignored): `run-view-final.html`,
`goal-create.html`, `clarification.html`, `loop-spec.html`, `gate-inbox.html`,
`results.html`, `context-memory.html`.

## Goals

- A polished, legible, futuristic interface that makes loops and agents easy to
  see, understand, and control.
- A consistent app shell and design system reused across every screen.
- Real-time run monitoring (streamed events, live budget meters, agent status).
- Human-in-the-loop controls (gate approvals) that present enough context to
  decide.
- Visual reinforcement of guardrails and honest failure/empty states.

## Non-goals (this milestone)

- The Phase-3 drag-and-drop loop **builder** (editable React Flow canvas with
  graph validation and templates). The Run view canvas is read-only/auto-laid-out
  here; "edit spec" opens form-based editing, not free-form canvas editing.
- Deep multi-tenant RBAC, org/workspace switching UI.
- Arabic / RTL layout polish.
- Model-building screens beyond what Results already accommodates (insights-first;
  models render with the same insight/metric patterns when present).

## Tech Stack

Per the project conventions (CLAUDE.md, PRD §5.2):

- **React 18 + TypeScript** (strict), **Vite**.
- **Tailwind CSS** + **shadcn/ui** for primitives, themed to the Glass tokens.
- **TanStack Query** for all server state (fetching, caching, mutations,
  invalidation).
- **Zustand** for UI-only state (selected agent, canvas viewport, panel
  open/closed, theme).
- **React Flow** for the agent canvas (nodes = agents, edges = handoffs;
  read-only interactions: pan, zoom, select, fit).
- **SSE (EventSource)** for live run events; a thin client merges events into
  TanStack Query caches and a run-event store.
- Lives in `/web` per the repo layout.

## Design System

A single source of truth in `web/src/styles/theme.css` (CSS variables) plus a
Tailwind theme extension. Tokens (from the approved mockups):

- Background field: `--bg0 #08081a` with two radial glows
  (violet `#8a6cff` top-right, teal `#4ad6ff` bottom-left).
- Accents: violet `#8a6cff`, teal `#4ad6ff`; status: ok `#46e3ad`,
  warn `#ffd166`, bad `#ff6b9a`.
- Text: ink `#f0eeff`, ink2 `#cfcbf0`, muted `#928db8`.
- Glass surfaces: `rgba(255,255,255,.05)` fill, `rgba(255,255,255,.10–.16)`
  borders, `backdrop-filter: blur(12–16px)`.
- Radii: 10–18px. Type: **Inter** (UI), **JetBrains Mono** (ids, numbers, code,
  timestamps).

Shared primitives (in `web/src/components/ui/`): `GlassCard`, `StatusPill`,
`MeterBar`, `Toggle`, `SegmentedControl`, `Chip` (tool / denied-tool variants),
`AgentAvatar` (glyph + state), `Dial` (clarity score), `Tag`, `EmptyState`,
`Button` (primary/ghost/danger/approve).

### Motion & states (polish requirements)

- Running indicator = pulsing dot + breathing avatar glow + animated flowing edge
  into the active agent. **No spinner rings.**
- Hover lift on interactive cards/nodes; selected = teal ring.
- Every list/data view defines **loading** (skeletons), **empty**, and **error**
  states. Empty states are first-class (e.g. `completed_no_findings`).
- Respect `prefers-reduced-motion` (disable pulses/flow animations).
- Keyboard accessible: focus rings, tab order, Enter/Esc on dialogs and gate
  actions; ARIA roles on canvas controls and live regions for streamed events.

## App Shell & Information Architecture

Persistent left **sidebar** + per-screen top bar. Sidebar groups:

- **BUILD**: Goals, Loop Specs
- **OPERATE**: Runs, Gate Inbox (count badge), Results, Context & Memory
- **SYSTEM**: Settings
- Footer: current runtime mode + LLM endpoint (e.g. "Local LLM · vLLM").

Routes (`web/src/routes`):

```
/goals                      list + entry to create
/goals/new                  Goal creation
/goals/:id/clarify          Clarification
/specs                      Loop Specs list
/specs/:id                  Loop Spec preview / approve
/runs                       Runs list
/runs/:id                   Run view (hero)  [tabs: Canvas | Timeline | Events]
/gates                      Gate Inbox
/runs/:id/results           Results / Report
/runs/:id/context           Context & Memory
/settings                   Settings
```

## Screens

### 1. Goal creation (`/goals/new`)

Single-column form (max ~760px) over the Glass field, sticky action footer.
Sections: **goal text** (autosizing textarea); **runtime mode** as two selectable
cards (Offline-Local default / Online-Enabled); **capabilities** as toggle rows
(code sandbox, local connectors, internet — internet is locked/disabled unless
mode = Online-Enabled, enforcing the no-silent-escalation guardrail); **budget
caps** (max steps, max LLM calls, max context tokens) as number inputs with
sliders, framed as a hard kill switch. Footer: Cancel / "Create & check clarity".

Maps to `GoalCreate` (`text`, `mode`, `toggles`, `constraints`, `budget`). Submit
→ `POST /api/goals`. Response routes to Clarification (if a clarification session
is returned) or to the generated Loop Spec.

### 2. Clarification (`/goals/:id/clarify`)

Two-pane. **Left**: chat transcript — the loop-maker asks one focused question at
a time (each tagged with the missing requirement and a short "why"); the user
answers in a composer. **Right**: **Missing Requirements** panel — a clarity
**Dial** (percentage) and a checklist of requirements (done / active / open).
When clarity clears threshold and no blocking gaps remain, a "loop spec ready"
state routes to the Loop Spec screen.

Maps to `ClarificationSession` (`questions`, `answers`, `missing_requirements`,
`clarity_score`). Needs endpoints to fetch the session and submit an answer
(see API surface).

### 3. Loop Spec preview / approve (`/specs/:id`)

The pivotal build-side screen. Header shows goal summary + `DRAFT` status. Body
is a two-column layout:

- **Left**: read-only **handoff graph** (compact node row with gate flags) and an
  **agent grid** — one card per agent showing avatar, name, role, system-prompt
  summary, and tool chips (denied tools rendered struck-through).
- **Right rail**: success criteria, failure / honest-empty behavior, approval
  gates, budget, context policy, improvement strategy.

Sticky footer: Reject / Edit spec / **Approve & enable run**. "Edit" opens
form-based editing of each section (not canvas editing). Approve →
`POST /api/loop-specs/:id/approve`.

Maps to `LoopSpec` (`agents`, `tool_permissions`, `handoffs`, `success_criteria`,
`failure_criteria`, `gates`, `context_policy`, `improvement_strategy`,
`version`, `status`).

### 4. Run view — hero (`/runs/:id`)

The control room. Top bar: breadcrumb + live status pill (pulsing) + Pause /
Cancel. **Meter rail**: cost, steps, context tokens (warn-tinted), iteration —
each a labeled `MeterBar` showing spent vs. cap. View switch:
**Canvas | Timeline | Events**.

- **Canvas** (default, React Flow): agents as nodes auto-laid-out left→right with
  clean ports and glowing handoff edges. Each node = avatar (state: done/running/
  idle), name, role, status pill, current-task line, tool chips, per-agent token
  bar + model. Running agent: pulsing dot + breathing glow + animated inbound
  edge. Canvas chrome: find-agent, legend, zoom controls, minimap.
- **Timeline**: one lane per agent over time with activity blocks, handoff
  markers, and gate markers (from the swimlane exploration).
- **Events**: the raw streamed event log (node/tool/llm/ctx/gate tags).

**Right inspector**: selected agent's system prompt, tools, handoffs, budget,
recent activity, and — when present — an inline **gate approval** card
(approve/reject without leaving the run).

Live data: subscribe to `GET /api/runs/:id/events` (SSE). Event types drive node
state, meters, the event log, and gate appearance:
`node_start|node_end|tool_call|llm_call|cost_update|gate_pending|run_status`.
Cancel/Pause → run control endpoints.

Maps to `Run`, `RunEvent`, `Gate`, and the loop's agents (from the approved
`LoopSpec`).

### 5. Gate Inbox (`/gates`)

Master/detail. **List**: pending gates across runs, each with gate-type tag, run
name, age, and one-line context. **Detail**: what happens next, cost & budget
(spent / est-to-finish / cap), what's found so far, a note that human sign-off
confirms business importance after judge triage, and actions: optional note +
Reject / Approve.

Maps to `Gate` (`gate_type`, `status`, `context`, `note`). Needs list + decision
endpoints.

### 6. Results / Report (`/runs/:id/results`)

Header: completed status + Export / Re-run. Summary tiles (validated / rejected /
cost / duration). **Top validated insights**, each: rank, claim, `PASSED` badge,
statistics row (test, p-value, effect size, n, correction), an optional plot or
baseline-comparison bar chart, and drill-down chips (view test code / view trace
/ context used). Honest-empty state for `completed_no_findings`. Models, when
present, reuse the same card pattern (metric vs. baseline + leakage status).

Maps to run `artifacts` (kind = insight | model | plot | report) and
`result_summary`.

### 7. Context & Memory (`/runs/:id/context`)

Two-pane. **Left**: the append-only **context ledger** as a timeline (goal, tool,
llm, artifact, and summary entries; summary entries marked distinctly and linking
to the raw events they compacted). **Right**: the **current context pack**
composition (stacked budget bar + per-source token breakdown vs. the token
budget), a compaction note ("working memory shrunk, audit log untouched"), and
the `context_overflow` guard explanation.

Maps to `ContextEntry` / `ContextPack` (`entries`, `summary`, `token_count`,
`overflow`).

## Data Flow & State

- **Server state** via TanStack Query: goals, clarification session, specs, runs,
  gates, artifacts, context. Mutations (create goal, submit answer, approve spec,
  start run, gate decision, cancel run) invalidate the relevant queries.
- **Run streaming**: an `EventSource` per open run feeds a reducer that updates
  (a) per-agent/node status, (b) the meter values, (c) the event log, (d) pending
  gate. The reducer state lives in a Zustand store keyed by run id; the inspector
  and canvas read from it.
- **UI state** via Zustand: selected agent, canvas viewport, active tab, sidebar
  state.
- **API client** in `web/src/lib/api/`: typed functions + a generated/zod-checked
  type layer mirroring the Pydantic models. A single `fetcher` injects auth and
  normalizes errors.

## API Surface (frontend requirements)

Already present:

- `POST /api/goals`
- `POST /api/loop-specs/{id}/approve`
- `POST /api/goals/{goal_id}/runs`
- `GET  /api/runs/{run_id}/events`  (must become an SSE stream)

Required additions (built with the UI):

- `GET  /api/goals`, `GET /api/goals/{id}`
- `GET  /api/goals/{id}/clarification`,
  `POST /api/goals/{id}/clarification/answers`
- `GET  /api/loop-specs/{id}`, `GET /api/loop-specs?goal_id=…`,
  `PATCH /api/loop-specs/{id}` (form edits)
- `GET  /api/runs`, `GET /api/runs/{id}`
- `POST /api/runs/{id}/cancel`, `POST /api/runs/{id}/pause`
- `GET  /api/gates?status=pending`, `POST /api/gates/{id}/decision`
- `GET  /api/runs/{id}/artifacts`, `GET /api/runs/{id}/results`
- `GET  /api/runs/{id}/context`  (ledger entries + current pack)

These are listed so the implementation plan can sequence backend + frontend work
together; detailed backend design is out of scope for this frontend spec.

## Guardrail Surfacing (cross-cutting)

- Data sources / connectors show a read-only verified badge.
- Denied tools render struck-through in spec and inspector.
- Internet toggle is disabled in Offline-Local; online tool usage is shown in the
  event log when in Online-Enabled.
- Budget meters are framed as a hard kill switch; nearing-cap = warn tint.
- Honest empty (`completed_no_findings`) and explicit error statuses
  (`unsafe_request`, `context_overflow`, `budget_exhausted`) have dedicated,
  non-alarming explanatory states.
- No raw PII is rendered; profiling values shown in the UI come from
  PII-masked payloads only.

## Testing Strategy

- **Unit (Vitest + React Testing Library)**: design-system primitives; the run
  event reducer (event sequence → derived agent/meter/gate state); form
  validation (budget bounds, mode/internet locking).
- **Component**: each screen renders with mock data across loading / empty /
  error / populated states; gate approve/reject flows; clarity-threshold routing.
- **Integration**: goal → clarify → spec → approve → run happy path against a
  mock API (MSW), asserting query invalidation and SSE-driven UI updates.
- **Accessibility**: keyboard traversal of gate actions and canvas controls;
  reduced-motion disables animations; axe checks on each screen.

## Build Order

1. Project scaffold (`/web`), Tailwind + Glass theme, design-system primitives,
   app shell + routing, API client + types, MSW mocks.
2. Goal creation → Clarification (with mock, then live endpoints).
3. Loop Spec preview / approve.
4. Run view: meter rail + Events tab first, then the React Flow Canvas, then the
   inspector + inline gate, then the Timeline tab.
5. Gate Inbox.
6. Results / Report.
7. Context & Memory.
8. Polish pass: motion, empty/error states, reduced-motion, accessibility,
   responsive behavior.

Backend endpoints are added just-in-time per screen (see API surface).
