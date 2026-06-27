# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the LoopForge web app (`/web`) as a runnable, navigable shell with the Holographic Glass design system, app shell + routing, a tested design-system primitive pattern, and the data layers (API client, TanStack Query, Zustand) — the foundation every screen plan builds on.

**Architecture:** A Vite + React + TypeScript (strict) single-page app in `/web`. Styling via Tailwind v4 (CSS-first `@theme` tokens) over a Glass design system. Server state via TanStack Query against a typed `fetcher`; UI-only state via Zustand. Routing via React Router with a persistent sidebar `AppLayout` and placeholder route pages. Tests via Vitest + React Testing Library (jsdom); API mocked with MSW.

**Tech Stack:** React 18, TypeScript 5 (strict), Vite, Tailwind CSS v4, React Router v6, TanStack Query v5, Zustand v5, React Flow (installed, used in later plans), Vitest, @testing-library/react, MSW.

## Global Constraints

- All frontend code lives under `/web`. Commands run from `/web` unless noted.
- TypeScript `strict: true`; no `any` in committed code (use `unknown` + narrowing).
- Design tokens are the single source of truth: violet `#8a6cff`, teal `#4ad6ff`, bg0 `#08081a`, ink `#f0eeff`, ink2 `#cfcbf0`, muted `#928db8`, ok `#46e3ad`, warn `#ffd166`, bad `#ff6b9a`. Fonts: Inter (UI), JetBrains Mono (mono).
- Every component file has one clear responsibility; co-locate its test as `*.test.tsx` beside it.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.
- Commit messages reference the spec (`[FR-UI]`) where relevant.
- Spec: `docs/superpowers/specs/2026-06-26-frontend-design.md`.

---

### Task 1: Scaffold the web app

**Files:**
- Create: `web/` (Vite React-TS scaffold: `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`)
- Modify: `web/tsconfig.json` (strict already on by template; verify)
- Modify: root `.gitignore` (ignore `web/node_modules`, `web/dist`)

**Interfaces:**
- Produces: a runnable Vite app; `npm run dev`, `npm run build` work from `/web`.

- [ ] **Step 1: Scaffold with Vite**

Run from repo root:
```bash
npm create vite@latest web -- --template react-ts
```
Expected: creates `web/` with the React-TS template.

- [ ] **Step 2: Install base dependencies**

Run:
```bash
cd web && npm install
npm install react-router-dom @tanstack/react-query zustand reactflow
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8 msw
```
Expected: installs succeed, `web/package.json` lists the deps.

- [ ] **Step 3: Ignore build artifacts**

Add to root `.gitignore` (append):
```
web/node_modules
web/dist
web/coverage
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: build completes, `web/dist` produced.

- [ ] **Step 5: Commit**

```bash
cd /Users/solo/Documents/Projects/agentic_loopforge
git add web .gitignore
git commit -m "chore(web): scaffold vite react-ts app [FR-UI]"
```

---

### Task 2: Tailwind v4 + Glass theme

**Files:**
- Modify: `web/vite.config.ts` (add Tailwind plugin)
- Modify: `web/src/index.css` (replace with Tailwind import + Glass tokens + base)
- Modify: `web/index.html` (add Inter + JetBrains Mono fonts)
- Modify: `web/src/App.tsx` (temporary visual check)

**Interfaces:**
- Produces: Tailwind utilities available; CSS variables `--bg0,--violet,--teal,--ink,--ink2,--mut,--ok,--warn,--bad,--glass,--glass2,--line,--line2`; `body` shows the Glass gradient field.

- [ ] **Step 1: Install Tailwind v4 vite plugin**

Run: `cd web && npm install -D tailwindcss @tailwindcss/vite`

- [ ] **Step 2: Register the plugin in Vite**

Replace `web/vite.config.ts` with:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
```

- [ ] **Step 3: Write the Glass theme CSS**

Replace `web/src/index.css` with:
```css
@import "tailwindcss";

:root {
  --bg0: #08081a;
  --violet: #8a6cff;
  --teal: #4ad6ff;
  --ink: #f0eeff;
  --ink2: #cfcbf0;
  --mut: #928db8;
  --ok: #46e3ad;
  --warn: #ffd166;
  --bad: #ff6b9a;
  --glass: rgba(255, 255, 255, 0.05);
  --glass2: rgba(255, 255, 255, 0.08);
  --line: rgba(255, 255, 255, 0.1);
  --line2: rgba(255, 255, 255, 0.16);
}

@theme {
  --color-bg0: var(--bg0);
  --color-violet: var(--violet);
  --color-teal: var(--teal);
  --color-ink: var(--ink);
  --color-ink2: var(--ink2);
  --color-mut: var(--mut);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-bad: var(--bad);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

html, body, #root { height: 100%; }

body {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(1100px 600px at 85% -12%, rgba(138, 108, 255, 0.26), transparent 58%),
    radial-gradient(900px 600px at -10% 112%, rgba(74, 214, 255, 0.18), transparent 60%),
    var(--bg0);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 4: Load fonts**

In `web/index.html`, inside `<head>`, add before `</head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

- [ ] **Step 5: Sanity check the field renders**

Replace `web/src/App.tsx` with:
```tsx
export default function App() {
  return (
    <div className="grid min-h-screen place-items-center">
      <h1 className="text-2xl font-bold text-ink">LoopForge</h1>
    </div>
  );
}
```
Run: `cd web && npm run dev`, open the URL.
Expected: dark violet→teal gradient field with "LoopForge" centered.

- [ ] **Step 6: Commit**

```bash
git add web/vite.config.ts web/src/index.css web/index.html web/src/App.tsx
git commit -m "feat(web): tailwind v4 + holographic glass theme [FR-UI]"
```

---

### Task 3: Vitest + Testing Library harness

**Files:**
- Create: `web/src/test/setup.ts`
- Create: `web/src/test/smoke.test.tsx`
- Modify: `web/package.json` (add `test` scripts)

**Interfaces:**
- Produces: `npm run test` runs Vitest; `@testing-library/jest-dom` matchers available; a passing smoke test.

- [ ] **Step 1: Test setup file**

Create `web/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

- [ ] **Step 2: Add test scripts**

In `web/package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the smoke test (failing first)**

Create `web/src/test/smoke.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "../App";

test("renders the app name", () => {
  render(<App />);
  expect(screen.getByText("LoopForge")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run it**

Run: `cd web && npm run test`
Expected: PASS (App already renders "LoopForge"). If it errors on setup, fix the setup path in `vite.config.ts`, then re-run.

- [ ] **Step 5: Commit**

```bash
git add web/src/test web/package.json
git commit -m "test(web): vitest + testing-library harness [FR-UI]"
```

---

### Task 4: Design tokens module + GlassCard primitive

**Files:**
- Create: `web/src/lib/cn.ts`
- Create: `web/src/components/ui/GlassCard.tsx`
- Create: `web/src/components/ui/GlassCard.test.tsx`

**Interfaces:**
- Produces:
  - `cn(...classes: Array<string | false | null | undefined>): string` — joins truthy class strings.
  - `GlassCard` — `React.FC<React.HTMLAttributes<HTMLDivElement>>` rendering a `<div>` with glass styling; merges incoming `className`; forwards children and props. This is the pattern every later primitive follows.

- [ ] **Step 1: Write the class-merge helper**

Create `web/src/lib/cn.ts`:
```ts
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/ui/GlassCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { GlassCard } from "./GlassCard";

test("renders children and merges className", () => {
  render(<GlassCard className="extra">hello</GlassCard>);
  const el = screen.getByText("hello");
  expect(el).toBeInTheDocument();
  expect(el).toHaveClass("extra");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/ui/GlassCard.test.tsx`
Expected: FAIL — cannot find `./GlassCard`.

- [ ] **Step 4: Implement GlassCard**

Create `web/src/components/ui/GlassCard.tsx`:
```tsx
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line)] bg-[var(--glass)] p-5 backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/ui/GlassCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/cn.ts web/src/components/ui/GlassCard.tsx web/src/components/ui/GlassCard.test.tsx
git commit -m "feat(web): cn helper + GlassCard primitive [FR-UI]"
```

---

### Task 5: Navigation model + Sidebar

**Files:**
- Create: `web/src/app/nav.ts`
- Create: `web/src/components/shell/Sidebar.tsx`
- Create: `web/src/components/shell/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks except `cn`.
- Produces:
  - `type NavItem = { label: string; to: string; icon: string; badge?: number }`
  - `type NavGroup = { heading: string; items: NavItem[] }`
  - `NAV_GROUPS: NavGroup[]` — BUILD (Goals `/goals`, Loop Specs `/specs`), OPERATE (Runs `/runs`, Gate Inbox `/gates`, Results `/results`, Context & Memory `/context`), SYSTEM (Settings `/settings`).
  - `Sidebar: React.FC<{ pathname: string }>` — renders groups; an item whose `to` is a prefix of `pathname` gets `aria-current="page"`.

- [ ] **Step 1: Write the nav model**

Create `web/src/app/nav.ts`:
```ts
export type NavItem = { label: string; to: string; icon: string; badge?: number };
export type NavGroup = { heading: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "BUILD",
    items: [
      { label: "Goals", to: "/goals", icon: "✦" },
      { label: "Loop Specs", to: "/specs", icon: "❖" },
    ],
  },
  {
    heading: "OPERATE",
    items: [
      { label: "Runs", to: "/runs", icon: "◉" },
      { label: "Gate Inbox", to: "/gates", icon: "⛬" },
      { label: "Results", to: "/results", icon: "▤" },
      { label: "Context & Memory", to: "/context", icon: "⌬" },
    ],
  },
  {
    heading: "SYSTEM",
    items: [{ label: "Settings", to: "/settings", icon: "⚙" }],
  },
];
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/shell/Sidebar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

test("marks the active item by path prefix", () => {
  render(
    <MemoryRouter>
      <Sidebar pathname="/runs/abc" />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /Runs/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /Goals/ })).not.toHaveAttribute("aria-current");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/shell/Sidebar.test.tsx`
Expected: FAIL — cannot find `./Sidebar`.

- [ ] **Step 4: Implement Sidebar**

Create `web/src/components/shell/Sidebar.tsx`:
```tsx
import { Link } from "react-router-dom";
import { NAV_GROUPS } from "../../app/nav";
import { cn } from "../../lib/cn";

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="flex w-[250px] flex-col gap-1 border-r border-[var(--line)] p-4">
      <div className="mb-6 flex items-center gap-3 px-1">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-teal font-extrabold shadow-[0_0_24px_rgba(138,108,255,.55)]">
          ◆
        </div>
        <b className="text-lg">LoopForge</b>
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <div className="mt-3 mb-1 px-2 text-[10px] font-bold tracking-[1.7px] text-mut">
            {group.heading}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active
                    ? "border border-[rgba(184,166,255,.45)] bg-gradient-to-br from-[rgba(138,108,255,.26)] to-[rgba(74,214,255,.14)] text-white"
                    : "border border-transparent text-mut hover:bg-[var(--glass)] hover:text-ink",
                )}
              >
                <span className="w-[18px] text-center">{item.icon}</span>
                {item.label}
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-bad px-2 text-[11px] font-extrabold text-[#220812]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/shell/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/nav.ts web/src/components/shell/Sidebar.tsx web/src/components/shell/Sidebar.test.tsx
git commit -m "feat(web): nav model + sidebar [FR-UI]"
```

---

### Task 6: Router + AppLayout + placeholder pages

**Files:**
- Create: `web/src/components/shell/AppLayout.tsx`
- Create: `web/src/pages/Placeholder.tsx`
- Create: `web/src/app/routes.tsx`
- Create: `web/src/app/routes.test.tsx`
- Modify: `web/src/main.tsx` (mount the router)
- Modify: `web/src/App.tsx` (becomes the routed tree or is replaced)

**Interfaces:**
- Consumes: `Sidebar`.
- Produces:
  - `AppLayout: React.FC` — renders `Sidebar` (fed the current `useLocation().pathname`) beside an `<Outlet/>` in a 2-column grid; main has `role="main"`.
  - `Placeholder: React.FC<{ title: string }>` — a heading-only page (`<h1>{title}</h1>`).
  - `AppRoutes: React.FC` — `<Routes>` mapping each nav path (+ `/goals/new`) to a `Placeholder`, with `/` redirecting to `/goals`.

- [ ] **Step 1: AppLayout**

Create `web/src/components/shell/AppLayout.tsx`:
```tsx
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
```

- [ ] **Step 2: Placeholder page**

Create `web/src/pages/Placeholder.tsx`:
```tsx
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-mut">Coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 3: Write the failing routing test**

Create `web/src/app/routes.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./routes";

test("renders the Runs page heading at /runs", () => {
  render(
    <MemoryRouter initialEntries={["/runs"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
});

test("redirects / to Goals", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd web && npx vitest run src/app/routes.test.tsx`
Expected: FAIL — cannot find `./routes`.

- [ ] **Step 5: Implement routes**

Create `web/src/app/routes.tsx`:
```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/shell/AppLayout";
import { Placeholder } from "../pages/Placeholder";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/goals" replace />} />
        <Route path="/goals" element={<Placeholder title="Goals" />} />
        <Route path="/goals/new" element={<Placeholder title="New Goal" />} />
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npx vitest run src/app/routes.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mount the router**

Replace `web/src/main.tsx` with:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
```
Delete `web/src/App.tsx` and update `web/src/test/smoke.test.tsx` to assert the shell instead:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/routes";

test("renders the sidebar brand", () => {
  render(
    <MemoryRouter initialEntries={["/goals"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  expect(screen.getByText("LoopForge")).toBeInTheDocument();
});
```

- [ ] **Step 8: Run the full suite + build**

Run: `cd web && npm run test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add web/src
git commit -m "feat(web): router + app layout + placeholder pages [FR-UI]"
```

---

### Task 7: Typed API client

**Files:**
- Create: `web/src/lib/api/client.ts`
- Create: `web/src/lib/api/client.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; body: unknown }`
  - `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` — prefixes `import.meta.env.VITE_API_BASE ?? ""`, sets `Content-Type: application/json`, parses JSON, throws `ApiError` on non-2xx.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/api/client.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";
import { ApiError, apiFetch } from "./client";

afterEach(() => vi.restoreAllMocks());

test("returns parsed JSON on success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: "g1" }), { status: 200 })),
  );
  await expect(apiFetch<{ id: string }>("/api/goals/g1")).resolves.toEqual({ id: "g1" });
});

test("throws ApiError on non-2xx", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ detail: "nope" }), { status: 404 })),
  );
  await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/api/client.test.ts`
Expected: FAIL — cannot find `./client`.

- [ ] **Step 3: Implement the client**

Create `web/src/lib/api/client.ts`:
```ts
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/api/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api
git commit -m "feat(web): typed api client with ApiError [FR-UI]"
```

---

### Task 8: Domain types + Query provider + MSW + sample hook

**Files:**
- Create: `web/src/lib/api/types.ts`
- Create: `web/src/lib/queryClient.ts`
- Create: `web/src/app/Providers.tsx`
- Create: `web/src/test/msw.ts`
- Create: `web/src/lib/api/goals.ts`
- Create: `web/src/lib/api/goals.test.tsx`
- Modify: `web/src/main.tsx` (wrap routes in `Providers`)
- Modify: `web/src/test/setup.ts` (start/stop MSW server)

**Interfaces:**
- Consumes: `apiFetch`.
- Produces:
  - `types.ts`: `RunStatus` union and `Goal` type mirroring the backend Pydantic model (`id, text, mode, status, created_at`).
  - `queryClient.ts`: `makeQueryClient(): QueryClient` (retry off in tests via default options).
  - `Providers`: wraps children in `QueryClientProvider`.
  - `test/msw.ts`: `server` (MSW `setupServer`) with a default `GET /api/goals` handler returning `[]`.
  - `goals.ts`: `useGoals(): UseQueryResult<Goal[]>` querying `["goals"]` via `apiFetch<Goal[]>("/api/goals")`.

- [ ] **Step 1: Domain types**

Create `web/src/lib/api/types.ts`:
```ts
export type RunStatus =
  | "completed"
  | "needs_clarification"
  | "blocked"
  | "budget_exhausted"
  | "failed"
  | "cancelled"
  | "unsafe_request"
  | "context_overflow"
  | "running"
  | "pending_approval";

export type Goal = {
  id: string;
  text: string;
  mode: "offline_local" | "online_enabled";
  status: RunStatus;
  created_at: string;
};
```

- [ ] **Step 2: Query client + Providers**

Create `web/src/lib/queryClient.ts`:
```ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
  });
}
```
Create `web/src/app/Providers.tsx`:
```tsx
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "../lib/queryClient";

const client = makeQueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: MSW server + setup wiring**

Create `web/src/test/msw.ts`:
```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const server = setupServer(
  http.get("/api/goals", () => HttpResponse.json([])),
);
```
Append to `web/src/test/setup.ts`:
```ts
import { afterAll, afterEach as afterEachVitest, beforeAll } from "vitest";
import { server } from "./msw";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEachVitest(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 4: Write the failing hook test**

Create `web/src/lib/api/goals.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw";
import { Providers } from "../../app/Providers";
import { useGoals } from "./goals";

test("useGoals returns goals from the API", async () => {
  server.use(
    http.get("/api/goals", () =>
      HttpResponse.json([
        { id: "g1", text: "find churn", mode: "offline_local", status: "completed", created_at: "2026-06-27T00:00:00Z" },
      ]),
    ),
  );
  const { result } = renderHook(() => useGoals(), { wrapper: Providers });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0].id).toBe("g1");
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/api/goals.test.tsx`
Expected: FAIL — cannot find `./goals`.

- [ ] **Step 6: Implement the hook**

Create `web/src/lib/api/goals.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Goal } from "./types";

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/api/goals") });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/api/goals.test.tsx`
Expected: PASS.

- [ ] **Step 8: Wrap the app in Providers**

In `web/src/main.tsx`, wrap `<AppRoutes/>` with `<Providers>`:
```tsx
import { Providers } from "./app/Providers";
// ...
<BrowserRouter>
  <Providers>
    <AppRoutes />
  </Providers>
</BrowserRouter>
```

- [ ] **Step 9: Run the full suite**

Run: `cd web && npm run test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add web/src
git commit -m "feat(web): domain types, query provider, msw, useGoals hook [FR-UI]"
```

---

### Task 9: Zustand UI store

**Files:**
- Create: `web/src/store/ui.ts`
- Create: `web/src/store/ui.test.ts`

**Interfaces:**
- Produces:
  - `useUiStore` — Zustand store with `selectedAgentId: string | null`, `setSelectedAgent(id: string | null): void`, `activeRunTab: "canvas" | "timeline" | "events"`, `setActiveRunTab(tab): void`. Defaults: `selectedAgentId: null`, `activeRunTab: "canvas"`.

- [ ] **Step 1: Write the failing test**

Create `web/src/store/ui.test.ts`:
```ts
import { useUiStore } from "./ui";

test("selects an agent and switches run tab", () => {
  useUiStore.getState().setSelectedAgent("analyst");
  expect(useUiStore.getState().selectedAgentId).toBe("analyst");
  useUiStore.getState().setActiveRunTab("events");
  expect(useUiStore.getState().activeRunTab).toBe("events");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/store/ui.test.ts`
Expected: FAIL — cannot find `./ui`.

- [ ] **Step 3: Implement the store**

Create `web/src/store/ui.ts`:
```ts
import { create } from "zustand";

type RunTab = "canvas" | "timeline" | "events";

type UiState = {
  selectedAgentId: string | null;
  setSelectedAgent: (id: string | null) => void;
  activeRunTab: RunTab;
  setActiveRunTab: (tab: RunTab) => void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  activeRunTab: "canvas",
  setActiveRunTab: (tab) => set({ activeRunTab: tab }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/store/ui.test.ts`
Expected: PASS.

- [ ] **Step 5: Final full check + commit**

Run: `cd web && npm run test && npm run build`
Expected: all tests PASS, build succeeds.
```bash
git add web/src/store
git commit -m "feat(web): zustand ui store [FR-UI]"
```

---

## Self-Review

**Spec coverage (foundation slice):** Tech stack (Task 1, 8), Glass design system + tokens (Task 2, 4), motion/reduced-motion base (Task 2), app shell + IA + routes (Task 5, 6), design-system primitive pattern (Task 4), server state via TanStack Query + typed client (Task 7, 8), MSW mocks (Task 8), UI state via Zustand (Task 9), test harness (Task 3). Remaining spec sections (individual screens, Run view canvas, builder, SSE reducer, backend endpoints) are explicitly deferred to plans 2–6.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `apiFetch<T>` (Task 7) is consumed by `useGoals` (Task 8); `Goal`/`RunStatus` defined once in `types.ts`; `cn` (Task 4) reused by `Sidebar` (Task 5); `Sidebar` consumed by `AppLayout` (Task 6); `NAV_GROUPS` paths match the routes in Task 6.
