import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/shell/AppLayout";
import { Placeholder } from "../pages/Placeholder";
import { GoalCreatePage } from "../pages/GoalCreatePage";
import { ClarificationPage } from "../pages/ClarificationPage";
import { LoopSpecPage } from "../pages/LoopSpecPage";
import { RunPage } from "../pages/RunPage";
import { GateInboxPage } from "../pages/GateInboxPage";

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
        <Route path="/runs" element={<Placeholder title="Runs" />} />
        <Route path="/runs/:runId" element={<RunPage />} />
        <Route path="/gates" element={<GateInboxPage />} />
        <Route path="/results" element={<Placeholder title="Results" />} />
        <Route path="/context" element={<Placeholder title="Context & Memory" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
