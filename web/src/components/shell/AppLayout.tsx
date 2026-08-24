import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="grid h-screen grid-cols-[250px_1fr] overflow-hidden">
      <Sidebar pathname={pathname} />
      <main role="main" className="h-screen overflow-auto">
        <Suspense fallback={<div className="p-8 text-mut">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
