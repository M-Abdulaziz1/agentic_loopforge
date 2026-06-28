import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/shell/AppLayout";
import { Placeholder } from "../pages/Placeholder";
import { GoalCreatePage } from "../pages/GoalCreatePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/goals" replace />} />
        <Route path="/goals" element={<Placeholder title="Goals" />} />
        <Route path="/goals/new" element={<GoalCreatePage />} />
        <Route path="/specs" element={<Placeholder title="Loop Specs" />} />
        <Route path="/runs" element={<Placeholder title="Runs" />} />
        <Route path="/gates" element={<Placeholder title="Gate Inbox" />} />
        <Route path="/results" element={<Placeholder title="Results" />} />
        <Route path="/context" element={<Placeholder title="Context & Memory" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
