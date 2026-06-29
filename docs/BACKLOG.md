# LoopForge backlog (outstanding work)

## Plan 4 — Visual Loop Builder (FRONTEND DONE — backend pending)

Frontend complete on `fe/plan-4`: graph validator, editable React Flow builder
(`/specs/:id/edit`), node config panel (capability locks), Templates page + save/instantiate.
**Remaining:** Codex to implement the templates backend (`GET/POST /api/templates`,
`POST /api/templates/{id}/instantiate`, `DELETE`) per the contract; then merge `fe/plan-4`.

Original scope (for reference) — editable React Flow canvas to compose/alter a loop:

- Editable canvas (add/remove/connect agent + gate nodes), reusing the Run view node
  components; auto-layout for the generated spec.
- Node config panel (name, role, system prompt, tool permissions — honoring goal-level
  capability locks).
- Continuous **graph validation** (no dangling required inputs, no orphans, one entry,
  reachable terminal, gate placement) — Save/Approve blocked while invalid.
- Templates: save a loop as a reusable template; instantiate into a new spec.
- Routes `/specs/:id/edit` (currently a placeholder) and `/templates`.
- Backend: `PATCH /api/loop-specs/{id}` (validation + guardrail enforcement),
  `GET/POST /api/templates`, `POST /api/templates/{id}/instantiate`, `DELETE` — all
  already drafted in `docs/contract/openapi.yaml`.

Spec: `docs/superpowers/specs/2026-06-26-frontend-design.md` (screens 3b, 3c).

## Other

- Push `main` to `origin` (was 29+ commits ahead).
- Free port `:8000` for dev integration (a foreign app squats it; integration done on `:8001`).
- Contract gap: Loop Spec **Reject** action has no endpoint — decide add `POST /api/loop-specs/{id}/reject` vs. drop.
- Polish pass (Plan 6): route-level code-splitting (React Flow bloats the bundle), reduced-motion, a11y, responsive.
