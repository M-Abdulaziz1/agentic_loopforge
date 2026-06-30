import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/shell/AppLayout";
import { Placeholder } from "../pages/Placeholder";

// Heavy/route-level pages are code-split so the initial bundle stays small.
// (The React Flow pages — Run view, Loop Builder — only load when visited.)
const GoalsListPage = lazy(() =>
  import("../pages/GoalsListPage").then((m) => ({ default: m.GoalsListPage })),
);
const SpecsListPage = lazy(() =>
  import("../pages/SpecsListPage").then((m) => ({ default: m.SpecsListPage })),
);
const GoalCreatePage = lazy(() =>
  import("../pages/GoalCreatePage").then((m) => ({ default: m.GoalCreatePage })),
);
const ClarificationPage = lazy(() =>
  import("../pages/ClarificationPage").then((m) => ({ default: m.ClarificationPage })),
);
const LoopSpecPage = lazy(() =>
  import("../pages/LoopSpecPage").then((m) => ({ default: m.LoopSpecPage })),
);
const LoopBuilderPage = lazy(() =>
  import("../pages/LoopBuilderPage").then((m) => ({ default: m.LoopBuilderPage })),
);
const TemplatesPage = lazy(() =>
  import("../pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })),
);
const DatasetsPage = lazy(() =>
  import("../pages/DatasetsPage").then((m) => ({ default: m.DatasetsPage })),
);
const EvaluatorsPage = lazy(() =>
  import("../pages/EvaluatorsPage").then((m) => ({ default: m.EvaluatorsPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const RunPage = lazy(() => import("../pages/RunPage").then((m) => ({ default: m.RunPage })));
const RunsListPage = lazy(() =>
  import("../pages/RunsListPage").then((m) => ({ default: m.RunsListPage })),
);
const ResultsPage = lazy(() =>
  import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage })),
);
const ContextPage = lazy(() =>
  import("../pages/ContextPage").then((m) => ({ default: m.ContextPage })),
);
const GateInboxPage = lazy(() =>
  import("../pages/GateInboxPage").then((m) => ({ default: m.GateInboxPage })),
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/goals" replace />} />
        <Route path="/goals" element={<GoalsListPage />} />
        <Route path="/goals/new" element={<GoalCreatePage />} />
        <Route path="/goals/:goalId/clarify" element={<ClarificationPage />} />
        <Route path="/specs" element={<SpecsListPage />} />
        <Route path="/specs/:specId" element={<LoopSpecPage />} />
        <Route path="/specs/:specId/edit" element={<LoopBuilderPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/evaluators" element={<EvaluatorsPage />} />
        <Route
          path="/runs"
          element={<RunsListPage title="Runs" to={(id) => `/runs/${id}`} />}
        />
        <Route path="/runs/:runId" element={<RunPage />} />
        <Route path="/runs/:runId/results" element={<ResultsPage />} />
        <Route path="/runs/:runId/context" element={<ContextPage />} />
        <Route path="/gates" element={<GateInboxPage />} />
        <Route
          path="/results"
          element={<RunsListPage title="Results" to={(id) => `/runs/${id}/results`} />}
        />
        <Route
          path="/context"
          element={
            <RunsListPage title="Context & Memory" to={(id) => `/runs/${id}/context`} />
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
