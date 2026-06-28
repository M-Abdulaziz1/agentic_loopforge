import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  sampleClarification,
  sampleGate,
  sampleGoal,
  sampleLoopSpec,
  sampleResults,
  sampleRun,
  sampleRunContext,
  sampleRunEvents,
} from "./fixtures";

// Default handlers conform to docs/contract/openapi.yaml. Individual tests override
// with server.use(...) for specific scenarios.
export const handlers = [
  http.get("/api/goals", () => HttpResponse.json([sampleGoal])),
  http.get("/api/goals/:goalId", () => HttpResponse.json(sampleGoal)),
  http.post("/api/goals", () =>
    HttpResponse.json(
      { goal: sampleGoal, clarification: sampleClarification, loop_spec: null },
      { status: 201 },
    ),
  ),
  http.get("/api/goals/:goalId/clarification", () =>
    HttpResponse.json(sampleClarification),
  ),
  http.post("/api/goals/:goalId/clarification/answers", () =>
    HttpResponse.json({
      clarification: { ...sampleClarification, clarity_score: 0.9, status: "ready" },
      loop_spec: sampleLoopSpec,
    }),
  ),
  http.get("/api/loop-specs", () => HttpResponse.json([sampleLoopSpec])),
  http.get("/api/loop-specs/:specId", () => HttpResponse.json(sampleLoopSpec)),
  http.patch("/api/loop-specs/:specId", () =>
    HttpResponse.json({ ...sampleLoopSpec, version: sampleLoopSpec.version + 1 }),
  ),
  http.post("/api/loop-specs/:specId/approve", () =>
    HttpResponse.json({ ...sampleLoopSpec, status: "approved" }),
  ),
  http.post("/api/goals/:goalId/runs", () =>
    HttpResponse.json(sampleRun, { status: 201 }),
  ),
  http.get("/api/runs", () => HttpResponse.json([sampleRun])),
  http.get("/api/runs/:runId", () => HttpResponse.json(sampleRun)),
  http.post("/api/runs/:runId/cancel", () =>
    HttpResponse.json({ ...sampleRun, status: "cancelled" }),
  ),
  http.post("/api/runs/:runId/pause", () => HttpResponse.json(sampleRun)),
  http.get("/api/runs/:runId/events", () => HttpResponse.json(sampleRunEvents)),
  http.get("/api/gates", () => HttpResponse.json([sampleGate])),
  http.post("/api/gates/:gateId/decision", () =>
    HttpResponse.json({ ...sampleGate, status: "approved" }),
  ),
  http.get("/api/runs/:runId/results", () => HttpResponse.json(sampleResults)),
  http.get("/api/runs/:runId/context", () => HttpResponse.json(sampleRunContext)),
  http.get("/api/runs/:runId/artifacts", () => HttpResponse.json([])),
];

export const server = setupServer(...handlers);
