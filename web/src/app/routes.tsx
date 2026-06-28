import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/shell/AppLayout";
import { Placeholder } from "../pages/Placeholder";
import { GoalCreatePage } from "../pages/GoalCreatePage";
import { ClarificationPage } from "../pages/ClarificationPage";
import { LoopSpecPage } from "../pages/LoopSpecPage";
import { RunPage } from "../pages/RunPage";
import { GateInboxPage } from "../pages/GateInboxPage";
import { ResultsPage } from "../pages/ResultsPage";
import { RunsListPage } from "../pages/RunsListPage";
import { ContextPage } from "../pages/ContextPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/goals" replace />} />
        <Route path="/goals" element={<Placeholder title="Goals" />} />
        <Route path="/goals/new" element={<GoalCreatePage />} />
        <Route path="/goals/:goalId/clarify" element={<ClarificationPage />} />
        <Route path="/specs" element={<Placeholder title="Loop Specs" />} />
        <Route path="/specs/:specId" element={<LoopSpecPage />} />
        <Route path="/specs/:specId/edit" element={<Placeholder title="Loop Builder" />} />
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
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
