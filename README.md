# DecisionOS MVP

This repository now contains a DecisionOS hackathon MVP scaffold defined by `AGENTS.md`.

## Structure

```text
frontend        # Next.js App Router frontend
backend         # FastAPI backend (JSON + SSE)
```

## Frontend

- Entry: `frontend/app/page.tsx`
- Core flow pages (idea-scoped):
  - `/ideas`
  - `/ideas/[ideaId]/idea-canvas`
  - `/ideas/[ideaId]/feasibility`
  - `/ideas/[ideaId]/feasibility/[id]`
  - `/ideas/[ideaId]/scope-freeze`
  - `/ideas/[ideaId]/prd`

Run commands:

```bash
pnpm dev:web
pnpm build:web
```

## Backend

- Entry: `backend/app/main.py`
- Health: `GET /health`
- Workspace and ideas:
  - `GET /workspaces/default`
  - `GET /ideas`
  - `POST /ideas`
  - `GET /ideas/{idea_id}`
  - `PATCH /ideas/{idea_id}`
  - `PATCH /ideas/{idea_id}/context`
- DAG canvas (idea-scoped):
  - `GET /ideas/{idea_id}/nodes`
  - `POST /ideas/{idea_id}/nodes`
  - `GET /ideas/{idea_id}/nodes/{node_id}`
  - `POST /ideas/{idea_id}/nodes/{node_id}/expand/user`
  - `POST /ideas/{idea_id}/nodes/{node_id}/expand/stream` (SSE, query param: `pattern_id`)
  - `POST /ideas/{idea_id}/paths`
  - `GET /ideas/{idea_id}/paths/latest`
- JSON endpoints:
  - `POST /ideas/{idea_id}/agents/opportunity`
  - `POST /ideas/{idea_id}/agents/feasibility`
  - `POST /ideas/{idea_id}/agents/scope`
  - `POST /ideas/{idea_id}/agents/prd`
  - `POST /ideas/{idea_id}/prd/feedback`
- SSE endpoints:
  - `POST /ideas/{idea_id}/agents/opportunity/stream`
  - `POST /ideas/{idea_id}/agents/feasibility/stream`
- AI aggregation settings:
  - `GET /settings/ai`
  - `PATCH /settings/ai`
  - `POST /settings/ai/test`
  - Frontend page: `/settings`

Legacy compatibility note:

- `POST /agents/*` now returns `410 Gone` and should not be used.

Setup and run:

```bash
cd backend
uv venv .venv
UV_CACHE_DIR=../.uv-cache uv pip install -r requirements.txt
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Optional env vars:

```bash
export LLM_MODE=auto  # default; set mock to force deterministic mock-only mode
export DECISIONOS_SECRET_KEY="replace-with-strong-secret"
```

AI provider behavior:

- Exactly **one** provider may be `enabled: true` at a time. The `PATCH /settings/ai` endpoint returns `422` if more than one provider is enabled simultaneously.
- The active provider is selected by `_get_active_provider()` in `ai_gateway.py`. If no provider is enabled, all AI calls raise `RuntimeError` with a user-friendly message.
- The frontend enforces radio-button semantics: clicking "Set Active" on a provider disables all others before enabling the chosen one.

Type checking:

```bash
cd backend
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python mypy app
```

## Notes

- Frontend uses Zustand persist with `skipHydration: true` and manual rehydrate.
- SSE client uses `fetch` stream parsing and supports `AbortController`.
- Backend mock outputs are deterministic by `idea_seed`.
- AI provider API keys are stored encrypted in SQLite using `DECISIONOS_SECRET_KEY` (set this in production).
- Idea Canvas is powered by a DAG (Directed Acyclic Graph) using `@xyflow/react`. Components live in `frontend/components/idea/dag/`.
- DAG expansion patterns are hardcoded in `backend/app/schemas/dag.py` (`EXPANSION_PATTERNS`): 缩小用户群体, 功能边界扩展, 场景迁移, 商业模式变体, 极简核心.
- Confirmed paths (`idea_paths`) store both `path_md` (Markdown, LLM-ready context) and `path_json` (structured, for cross-idea analysis) for use in downstream stages.
- `confirmed_dag_path_id` is stamped onto `idea.context_json` by the `POST /ideas/{idea_id}/paths` endpoint. This field gates the Feasibility stage: `canRunFeasibility` in `frontend/lib/guards.ts` returns `true` only when this field is set. After confirming a path, the UI automatically navigates to `/ideas/{ideaId}/feasibility`.
- `POST /ideas/{idea_id}/nodes` (create root node) is **idempotent**: if nodes already exist for the idea, the endpoint returns the existing root node instead of creating a duplicate. This prevents the duplicate root node bug caused by React 18 StrictMode double-mounting `useEffect`.
- The `IdeaDAGCanvas` init `useEffect` uses a `cancelled` flag in its cleanup to prevent async race conditions in React 18 StrictMode. Both the frontend flag and backend idempotency are required as defence-in-depth.
- The `idea-canvas` page passes `idea.idea_seed ?? idea.title` as `ideaSeed` to `IdeaDAGCanvas`. Without this fallback, new ideas with `idea_seed = null` would pass an empty string and trigger a `422` from the backend (which enforces `min_length=1` on `CreateRootNodeRequest.content`).

## PRD V2 Contract

- `POST /ideas/{idea_id}/agents/prd` request body is minimal:
  - `version: number`
  - `baseline_id: string`
- Backend assembles `context_pack` from canonical sources:
  - Step2: latest confirmed path (`idea_paths.path_md/path_json/summary`)
  - Step3: selected feasibility plan and alternatives
  - Step4: frozen scope baseline + mapped scope details
- Response envelope remains `{ idea_id, idea_version, data }`, where `data` is PRD V2:
  - `markdown`
  - `sections[]`
  - `requirements[]`
  - `backlog.items[]` (each item includes `requirement_id`)
  - `generation_meta`
- PRD persistence fields in `idea.context_json`:
  - `prd` (latest parsed output)
  - `prd_bundle` (baseline + fingerprint + output + metadata)

### Strict Failure Behavior

- `LLM_MODE=mock`: deterministic mock generation is allowed.
- `LLM_MODE!=mock`: PRD generation is strict and does **not** silently fallback to mock.
- Provider/schema failures return:
  - HTTP `502`
  - `detail.code = PRD_GENERATION_FAILED`

## PRD Feedback Contract

- `POST /ideas/{idea_id}/prd/feedback`
- Request body:
  - `version`
  - `baseline_id`
  - `rating_overall` (1-5)
  - `rating_dimensions` (`clarity|completeness|actionability|scope_fit`, each 1-5)
  - `comment?`
- Write semantics:
  - CAS/optimistic lock required (`version`)
  - only latest record is kept in `context.prd_feedback_latest`
  - successful write bumps `idea.version`

## DAG SSE Event Format

The DAG expand stream (`POST /ideas/{idea_id}/nodes/{node_id}/expand/stream`) uses named SSE events, **not** the general agent envelope:

```
event: progress
data: {"step": "generating", "pct": 10}

event: progress
data: {"step": "persisting", "pct": 70}

event: done
data: {"idea_id": "...", "nodes": [{...IdeaNodeOut...}]}

event: error
data: {"code": "EXPAND_FAILED", "message": "..."}
```

This differs from the opportunity/feasibility agent SSE streams which use a general envelope `{idea_id, idea_version, data}`. The DAG SSE does **not** bump `idea_version`.
