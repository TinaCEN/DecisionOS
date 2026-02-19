# DecisionOS MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a stable 7-day DecisionOS hackathon MVP with deterministic mock backend, POST-SSE streaming, and guarded multi-step product workflow.

**Architecture:** Use a monorepo layout with `apps/web` (Next.js App Router) and `services/api` (FastAPI). Frontend state is centralized in a persisted Zustand store with manual hydration to avoid Next.js mismatch. Backend returns schema-validated JSON and SSE events, with deterministic mock data and type-checked Python code.

**Tech Stack:** Next.js + TypeScript + Zustand + Framer Motion + dnd-kit + sonner + FastAPI + Pydantic + sse-starlette + mypy.

---

### Task 1: Bootstrap Monorepo Structure

**Files:**

- Create: `apps/web/*` (new Next.js app)
- Create: `services/api/app/main.py`
- Create: `services/api/app/routes/health.py`
- Modify: `README.md`

**Step 1: Create backend smoke test first**

```python
# services/api/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_ok() -> None:
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json() == {'ok': True}
```

**Step 2: Run test to verify it fails**

Run: `cd services/api && pytest tests/test_health.py -v`
Expected: FAIL because app/routes not created.

**Step 3: Implement minimal FastAPI app + health route**

```python
# services/api/app/main.py
from fastapi import FastAPI
from app.routes.health import router as health_router

app = FastAPI(title='DecisionOS API')
app.include_router(health_router)
```

```python
# services/api/app/routes/health.py
from fastapi import APIRouter

router = APIRouter()

@router.get('/health')
def health() -> dict[str, bool]:
    return {'ok': True}
```

**Step 4: Re-run test**

Run: `cd services/api && pytest tests/test_health.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web services/api README.md
git commit -m "chore: bootstrap decisionos web and api skeleton"
```

### Task 2: Shared Contracts and Frontend Store Hydration

**Files:**

- Create: `apps/web/lib/schemas.ts`
- Create: `apps/web/lib/store.ts`
- Create: `apps/web/components/providers/StoreHydration.tsx`
- Create: `apps/web/components/providers/ToasterProvider.tsx`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/guards.ts`

**Step 1: Write failing frontend store hydration test**

```ts
// apps/web/lib/store.test.ts
import { useDecisionStore } from './store'

test('persist config uses skipHydration true', () => {
  // expect exported persist options to include skipHydration true
})
```

**Step 2: Run failing test**

Run: `cd apps/web && pnpm test lib/store.test.ts`
Expected: FAIL until store is implemented.

**Step 3: Implement schemas/store/providers/guards**

- Add Zod schemas matching backend contracts.
- Add Zustand `persist` with `skipHydration: true`.
- Add `StoreHydration` client component calling `rehydrate()` on mount.
- Keep `app/layout.tsx` as server component and inject hydration + sonner providers.

**Step 4: Re-run lint/type check**

Run: `cd apps/web && pnpm lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/lib apps/web/components/providers apps/web/app/layout.tsx
git commit -m "feat: add decision context store hydration and route guards"
```

### Task 3: Backend Schemas, Mock Data, CORS, and mypy

**Files:**

- Create: `services/api/app/schemas/common.py`
- Create: `services/api/app/schemas/idea.py`
- Create: `services/api/app/schemas/feasibility.py`
- Create: `services/api/app/schemas/scope.py`
- Create: `services/api/app/schemas/prd.py`
- Create: `services/api/app/core/mock_data.py`
- Create: `services/api/app/core/llm.py`
- Create: `services/api/app/core/settings.py`
- Create: `services/api/app/routes/agents.py`
- Modify: `services/api/app/main.py`
- Modify: `services/api/requirements.txt`
- Create: `services/api/mypy.ini`

**Step 1: Write failing API schema tests**

```python
def test_opportunity_returns_three_directions():
    r = client.post('/agents/opportunity', json={'idea_seed': 'x'})
    assert len(r.json()['directions']) == 3
```

**Step 2: Run tests to confirm failure**

Run: `cd services/api && pytest tests -v`
Expected: FAIL on missing routes/schemas.

**Step 3: Implement Pydantic contracts + deterministic mocks + routes + CORS**

- Enforce exact field names from `AGENT.md`.
- Add CORS allow origin `http://localhost:3000`.
- Return deterministic 3 directions / 3 plans.

**Step 4: Run tests + mypy**

Run: `cd services/api && pytest tests -v && mypy app`
Expected: PASS.

**Step 5: Commit**

```bash
git add services/api/app services/api/requirements.txt services/api/mypy.ini
git commit -m "feat: implement typed mock agent endpoints with cors"
```

### Task 4: POST SSE Endpoints and Web Streaming Client

**Files:**

- Modify: `services/api/app/routes/agents.py`
- Create: `apps/web/lib/sse.ts`
- Create: `apps/web/lib/api.ts`
- Modify: `apps/web/components/idea/IdeaCanvas.tsx`
- Modify: `apps/web/components/feasibility/PlanCards.tsx`

**Step 1: Write failing stream parser tests**

```ts
// parse `event:` + `data:` frames and dispatch by event name
```

**Step 2: Run failing tests**

Run: `cd apps/web && pnpm test lib/sse.test.ts`
Expected: FAIL until parser exists.

**Step 3: Implement SSE endpoints and client with AbortSignal**

- Backend yields `progress`, `partial`, `done`.
- Frontend uses POST stream API (not native EventSource).
- Add AbortController per submit + unmount cleanup.

**Step 4: Manual verification**

Run web + api, trigger rapid double submit, confirm no duplicate/interleaved writes.
Expected: first request aborted, second stream authoritative.

**Step 5: Commit**

```bash
git add services/api/app/routes/agents.py apps/web/lib/sse.ts apps/web/lib/api.ts apps/web/components
git commit -m "feat: add post-sse streaming with abort-safe client integration"
```

### Task 5: Idea Canvas UI and Navigation

**Files:**

- Create: `apps/web/app/idea-canvas/page.tsx`
- Create: `apps/web/components/idea/Bubble.tsx`
- Create: `apps/web/components/idea/PathCards.tsx`
- Modify: `apps/web/components/idea/IdeaCanvas.tsx`

**Step 1: Write failing component behavior tests**

- Enter submit triggers request.
- Bubble click sets `selected_direction_id`.
- Path click sets `path_id` and routes `/feasibility`.

**Step 2: Run failing tests**

Run: `cd apps/web && pnpm test components/idea -v`
Expected: FAIL first.

**Step 3: Implement Framer Motion absolute/trig layout and interactions**

- No React Flow.
- Hover pain tags.
- Selected bubble center animation, others fade.

**Step 4: Run tests + lint**

Run: `cd apps/web && pnpm lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/app/idea-canvas apps/web/components/idea
git commit -m "feat: build framer-motion idea canvas workflow"
```

### Task 6: Feasibility List + Detail + Confirm Flow

**Files:**

- Create: `apps/web/app/feasibility/page.tsx`
- Create: `apps/web/app/feasibility/[id]/page.tsx`
- Create: `apps/web/components/feasibility/PlanCards.tsx`
- Create: `apps/web/components/feasibility/PlanDetail.tsx`

**Step 1: Write failing route guard and selection tests**

- Guard if missing context.
- Confirm sets selected plan and routes to scope page.

**Step 2: Run failing tests**

Run: `cd apps/web && pnpm test app/feasibility -v`
Expected: FAIL first.

**Step 3: Implement pages/components and route transitions**

- Stream/fetch plans.
- Hover shows dimension scores.
- Detail shows reasoning/positioning.

**Step 4: Manual e2e check**

From Idea to Feasibility detail to Confirm.
Expected: context preserved and route flow valid.

**Step 5: Commit**

```bash
git add apps/web/app/feasibility apps/web/components/feasibility
git commit -m "feat: add feasibility scoring list and detail confirmation flow"
```

### Task 7: Scope Freeze with dnd-kit Cross-Container Drag

**Files:**

- Create: `apps/web/app/scope-freeze/page.tsx`
- Create: `apps/web/components/scope/ScopeBoard.tsx`
- Create: `apps/web/components/scope/ScopeColumn.tsx`
- Create: `apps/web/components/scope/ScopeItem.tsx`

**Step 1: Write failing drag migration test**

- `onDragOver` should move active item between IN/OUT before drop.

**Step 2: Run failing tests**

Run: `cd apps/web && pnpm test components/scope -v`
Expected: FAIL first.

**Step 3: Implement sortable board + freeze lock state**

- `onDragOver` for cross-container live migration.
- `onDragEnd` reorder.
- Freeze disables DnD and persists lock state.

**Step 4: Manual interaction test**

Drag item into other column before drop; click Freeze; refresh.
Expected: lock persists and board disabled.

**Step 5: Commit**

```bash
git add apps/web/app/scope-freeze apps/web/components/scope apps/web/lib/store.ts
git commit -m "feat: implement scope freeze board with dnd-kit live migration"
```

### Task 8: PRD Placeholder (Optional Markdown Rendering)

**Files:**

- Create: `apps/web/app/prd/page.tsx`
- Create: `apps/web/components/prd/PrdView.tsx`
- Optional modify: `services/api/app/routes/agents.py`

**Step 1: Write failing render test**

- Page must never be blank and must show context summary.

**Step 2: Run failing test**

Run: `cd apps/web && pnpm test app/prd -v`
Expected: FAIL first.

**Step 3: Implement placeholder summary and optional markdown**

- If optional endpoint used: render markdown and copy button.

**Step 4: Run lint/build smoke**

Run: `cd apps/web && pnpm lint && pnpm build`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/app/prd apps/web/components/prd services/api/app/routes/agents.py
git commit -m "feat: add prd summary page with optional markdown rendering"
```

### Task 9: End-to-End Demo Verification and Hard Constraints Check

**Files:**

- Modify: `README.md`
- Create: `docs/demo-script.md`

**Step 1: Run backend and frontend**

Run:

- `cd services/api && uvicorn app.main:app --reload --port 8000`
- `cd apps/web && pnpm dev --port 3000`

Expected: both services healthy.

**Step 2: Execute full demo script**

- Home → Idea Canvas → Feasibility → Detail Confirm → Scope Freeze → PRD.

Expected: full flow success without hydration mismatch or stream leakage.

**Step 3: Hard constraints audit**

- Confirm no `reactflow` / `react-beautiful-dnd` dependency.
- Confirm `skipHydration: true` + manual rehydrate.
- Confirm SSE POST + AbortController + `/stream` routes.
- Confirm backend CORS + `sse-starlette` + `mypy`.

**Step 4: Final verification commands**

Run:

- `cd services/api && mypy app`
- `cd services/api && pytest -q`
- `cd apps/web && pnpm lint && pnpm build`

Expected: all pass.

**Step 5: Commit**

```bash
git add README.md docs/demo-script.md
git commit -m "docs: add demo script and final constraint checklist"
```
