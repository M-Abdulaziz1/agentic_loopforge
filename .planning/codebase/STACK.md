# Technology Stack

**Analysis Date:** 2026-07-11

## Languages

**Primary:**
- Python 3.12+ - FastAPI API, orchestration, persistence, provider adapters, and sandbox execution under `api/loopforge/`; version floor is declared in `pyproject.toml`
- TypeScript 6.0 - React SPA, API hooks, state stores, and tests under `web/src/`; strict ES2023 settings are in `web/tsconfig.app.json`

**Secondary:**
- CSS - Tailwind CSS 4 directives and application styles in `web/src/index.css`
- HTML - Vite application shell in `web/index.html`
- Dockerfile - Python sandbox images in `docker/sandbox.Dockerfile` and `docker/opencode-sandbox.Dockerfile`
- YAML - HTTP contract in `docs/contract/openapi.yaml`

## Runtime

**Environment:**
- CPython >=3.12 - backend and agent code; declared by `pyproject.toml` and based on `python:3.12-slim` in both sandbox Dockerfiles
- Node.js - frontend toolchain; Vite 8's installed dependency metadata requires Node.js 20.19+, 22.12+, or 24+ in `web/package-lock.json`
- Browser with ES2023 support - React SPA output from `web/src/main.tsx` and `web/tsconfig.app.json`
- Docker Engine with the gVisor `runsc` runtime - isolated agent execution implemented by `api/loopforge/providers.py`

**Package Manager:**
- pip - Python dependencies and editable extras are declared in `pyproject.toml`; no Python lockfile is present
- npm - frontend dependencies are declared in `web/package.json`
- Lockfile: `web/package-lock.json` is present (lockfile version 3)

## Frameworks

**Core:**
- FastAPI >=0.115,<1.0 - backend ASGI API in `api/loopforge/app.py`
- Pydantic >=2.8,<3.0 - domain models and settings in `api/loopforge/domain.py` and `api/loopforge/settings.py`
- React ^19.2.7 - frontend rendering and components under `web/src/`
- React Router DOM ^7.18.0 - client-side routes in `web/src/app/routes.tsx`
- TanStack React Query ^5.101.1 - server-state fetching and mutations under `web/src/lib/api/`
- Zustand ^5.0.14 - local UI and theme state in `web/src/store/`
- React Flow ^11.11.4 - visual agent-loop builder in `web/src/pages/LoopBuilderPage.tsx`

**Testing:**
- pytest >=8.2,<9.0 - backend tests under `tests/`, configured in `pyproject.toml`
- Vitest ^4.1.9 with jsdom ^29.1.1 - frontend tests under `web/src/`, configured in `web/vite.config.ts`
- Testing Library React ^16.3.2 and user-event ^14.6.1 - component interaction tests under `web/src/`
- MSW ^2.14.6 - frontend API mocks in `web/src/test/msw.ts`

**Build/Dev:**
- Uvicorn >=0.30,<1.0 - local ASGI server for `api.loopforge.app:app`, documented in `README.md`
- Vite ^8.1.0 - frontend dev server and production bundler configured in `web/vite.config.ts`
- TypeScript ~6.0.2 - strict type checking before builds via `tsc -b` in `web/package.json`
- Tailwind CSS ^4.3.1 with `@tailwindcss/vite` ^4.3.1 - styling pipeline configured in `web/vite.config.ts`
- Oxlint ^1.69.0 - frontend lint command in `web/package.json`

## Key Dependencies

**Critical:**
- `httpx` >=0.27,<1.0 - synchronous OpenAI-compatible HTTP client and provider error normalization in `api/loopforge/providers.py`
- `fastapi` >=0.115,<1.0 - REST and server-sent event surface in `api/loopforge/app.py`
- `pydantic` >=2.8,<3.0 - validated API/domain records persisted by `api/loopforge/sqlite_store.py`
- `@tanstack/react-query` ^5.101.1 - frontend query cache and mutations in `web/src/lib/api/`
- `reactflow` ^11.11.4 - node-and-edge editing UI in `web/src/pages/LoopBuilderPage.tsx`

**Infrastructure:**
- Python `sqlite3` standard library - WAL-backed local record store in `api/loopforge/sqlite_store.py`
- Python `subprocess` standard library - Docker CLI invocation in `api/loopforge/providers.py`
- `opencode-ai` >=0.1.0a36 - optional SDK extra, lazily imported by `api/loopforge/runtime.py` when the opencode engine is selected
- Docker/gVisor - non-root, read-only, resource-limited execution configured by `api/loopforge/providers.py`
- Sandbox data-science packages - pandas, NumPy, SciPy, scikit-learn, statsmodels, XGBoost, LightGBM, Matplotlib, and Seaborn are installed into `docker/sandbox.Dockerfile` and `docker/opencode-sandbox.Dockerfile`

## Configuration

**Environment:**
- Use `Settings.from_env()` in `api/loopforge/settings.py`; it reads process variables first and optionally loads `.env` through the repository's dependency-free parser
- Configure persistence with `LOOPFORGE_STORAGE_PATH`, `LOOPFORGE_DATASET_STORAGE_PATH`, and `LOOPFORGE_DATASET_MAX_SIZE_BYTES`
- Configure the model endpoint with `LOOPFORGE_LLM_PROVIDER`, `LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL`, `LOOPFORGE_OPENAI_COMPATIBLE_API_KEY`, `LOOPFORGE_OPENAI_COMPATIBLE_MODEL`, and `LOOPFORGE_OPENAI_COMPATIBLE_TIMEOUT_SECONDS`
- Configure isolated execution with the `LOOPFORGE_DOCKER_*` and `LOOPFORGE_SANDBOX_PROVIDER` variables consumed by `api/loopforge/settings.py`
- Configure the optional opencode engine with `LOOPFORGE_AGENT_ENGINE` and the `LOOPFORGE_OPENCODE_*` variables consumed by `api/loopforge/settings.py`
- Configure the browser API origin with `VITE_API_BASE` in `web/src/lib/api/client.ts` and `web/src/lib/api/datasets.ts`; local Vite development proxies `/api` to `http://localhost:8000` via `web/vite.config.ts`
- `.env` and `.env.example` exist at the repository root; their contents are intentionally not part of this analysis

**Build:**
- Python package metadata and pytest settings: `pyproject.toml`
- Frontend scripts and dependencies: `web/package.json`
- Reproducible frontend dependency graph: `web/package-lock.json`
- TypeScript project references and compiler settings: `web/tsconfig.json`, `web/tsconfig.app.json`, and `web/tsconfig.node.json`
- Vite, React, Tailwind, dev proxy, and Vitest settings: `web/vite.config.ts`
- Sandbox image definitions: `docker/sandbox.Dockerfile` and `docker/opencode-sandbox.Dockerfile`

## Platform Requirements

**Development:**
- Use Python 3.12+ with `pip install -e .[dev]` for the backend described by `pyproject.toml`
- Use a Vite-supported Node.js release and `npm install` in `web/`, then run the scripts in `web/package.json`
- Run backend and frontend as separate processes following `README.md`; the frontend dev server proxies API traffic to port 8000
- Install Docker plus gVisor `runsc` and build the repository sandbox images before executing real agent code through `api/loopforge/providers.py`
- Install `.[opencode]` and build `docker/opencode-sandbox.Dockerfile` only when selecting the optional opencode agent engine documented in `docs/opencode.md`

**Production:**
- No hosting platform or production deployment manifest is defined
- Serve the ASGI app from `api/loopforge/app.py` and the built static frontend from `web/dist/` using operator-selected infrastructure
- Provide persistent storage for the SQLite file and dataset directory configured in `api/loopforge/settings.py`
- Provide Docker Engine, gVisor `runsc`, approved sandbox images, and an egress-allowlisted Docker network when opencode mode is enabled

---

*Stack analysis: 2026-07-11*
