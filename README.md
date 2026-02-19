# DecisionOS MVP

This repository now contains a DecisionOS hackathon MVP scaffold defined by `AGENT.md`.

## Structure

```text
frontend        # Next.js App Router frontend
backend         # FastAPI backend (JSON + SSE)
```

## Frontend

- Entry: `frontend/app/page.tsx`
- Core flow pages:
  - `/idea-canvas`
  - `/feasibility`
  - `/feasibility/[id]`
  - `/scope-freeze`
  - `/prd`

Run commands:

```bash
pnpm dev:web
pnpm build:web
```

## Backend

- Entry: `backend/app/main.py`
- Health: `GET /health`
- JSON endpoints:
  - `POST /agents/opportunity`
  - `POST /agents/feasibility`
  - `POST /agents/scope`
  - `POST /agents/prd`
- SSE endpoints:
  - `POST /agents/opportunity/stream`
  - `POST /agents/feasibility/stream`

Setup and run:

```bash
cd backend
uv venv .venv
UV_CACHE_DIR=../.uv-cache uv pip install -r requirements.txt
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Type checking:

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python mypy app
```

## Notes

- Frontend uses Zustand persist with `skipHydration: true` and manual rehydrate.
- SSE client uses `fetch` stream parsing and supports `AbortController`.
- Backend mock outputs are deterministic by `idea_seed`.
