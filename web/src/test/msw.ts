import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { sampleClarification, sampleGoal, sampleLoopSpec } from "./fixtures";

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
];

export const server = setupServer(...handlers);
