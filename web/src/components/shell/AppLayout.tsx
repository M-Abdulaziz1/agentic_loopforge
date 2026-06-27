import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="grid min-h-screen grid-cols-[250px_1fr]">
      <Sidebar pathname={pathname} />
      <main role="main" className="min-h-screen overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
