# AGENT.md — DecisionOS (Hackathon MVP, final spec)

本文件是可直接交给 Codex/CLI agent 逐任务执行的完整规格说明（含上下文、架构决策、数据契约、任务拆分、验收标准）。目标是 7 天内做出稳定可演示的 MVP，并避免已知的 Next.js/Zustand/SSE/dnd-kit 常见地雷。后端 Python 代码必须包含类型检查（mypy/pyright 其一），以便运行前发现问题。

---

## 0. Product context

**产品名称**：DecisionOS（可后续改名，不影响 MVP）
**定位**：模块化 AI 产品决策工作台，把“模糊想法”转成可执行的产品方案。
**MVP 目标用户**：独立开发者与黑客松团队。
**核心模块（MVP 必做）**：

1. Idea Canvas：输入 idea seed → 生成 3 个方向气泡 → 选方向 → 选路径
2. Feasibility Scorer：Top3 方案卡片（含综合分与维度分）→ 详情 → Confirm
3. Scope Freeze：IN/OUT 两栏拖拽 → Freeze 冻结动效锁定
4. PRD 页：可占位；可选实现 Markdown 输出

**明确不做**：账号/历史记录、多端适配、多人协作、第三方工具集成（Notion/Jira）。

---

## 1. Non-negotiable technical decisions (final)

### 1.1 Frontend

- **不使用 React Flow**：Idea Canvas 是布局动画场景，用 **Framer Motion + absolute positioning + 三角函数坐标**实现。
- DnD：**@dnd-kit/core + @dnd-kit/sortable**。必须实现跨容器拖拽的 **onDragOver** 实时迁移。
- 状态：**Zustand + persist**。必须使用 `skipHydration: true` + 客户端手动 `rehydrate()` 避免 hydration mismatch。
- Streaming：后端 SSE 端点为 **POST**，前端**禁止**使用原生 `EventSource`（仅支持 GET）。前端必须使用：
  - 方案 A（推荐）：**fetch-event-stream**（轻量专为 POST SSE）
  - 方案 B：手写 `fetch + ReadableStream` SSE 解析（仅当不想引依赖）

- SSE 必须支持 **AbortController**：页面卸载/二次提交时取消上一次流，避免并发写 store 与卸载后 setState 警告。
- Toast：**sonner**。
- PRD Markdown（可选）：`react-markdown` + `remark-gfm`。

### 1.2 Backend

- FastAPI + Pydantic。
- SSE 使用 **sse-starlette**（`EventSourceResponse`）。
- `LLM_MODE=mock|modelscope`，默认 `mock`，任何失败都 fallback 到 mock 保证 demo 稳定。
- 必须加 CORS：`http://localhost:3000` → `http://localhost:8000`。
- Python 必须有类型检查：
  - 推荐：**mypy**（requirements 增加 mypy）+ 在 Task 中加入 `mypy services/api/app`（或项目路径）
  - 或：**pyright**（node 工具）。MVP 建议 mypy，集成更直接。

---

## 2. Repo structure (create exactly)

```
decisionos/
  apps/
    web/
      app/
        layout.tsx
        page.tsx
        idea-canvas/page.tsx
        feasibility/page.tsx
        feasibility/[id]/page.tsx
        scope-freeze/page.tsx
        prd/page.tsx
      components/
        providers/StoreHydration.tsx
        providers/ToasterProvider.tsx
        home/EntryCards.tsx
        idea/IdeaCanvas.tsx
        idea/Bubble.tsx
        idea/PathCards.tsx
        feasibility/PlanCards.tsx
        feasibility/PlanDetail.tsx
        scope/ScopeBoard.tsx
        scope/ScopeColumn.tsx
        scope/ScopeItem.tsx
        prd/PrdView.tsx
      lib/
        api.ts
        sse.ts
        schemas.ts
        store.ts
        guards.ts
  services/
    api/
      app/
        main.py
        routes/
          health.py
          agents.py
        core/
          settings.py
          llm.py
          prompts.py
          mock_data.py
        schemas/
          common.py   # MUST match apps/web/lib/schemas.ts
          idea.py
          feasibility.py
          scope.py
          prd.py
      requirements.txt
      mypy.ini (or pyproject.toml mypy config)
  README.md
  AGENT.md
```

---

## 3. Data contracts (Zod ↔ Pydantic must match)

### 3.1 Core types

#### Direction

```json
{ "id": "A", "title": "string", "one_liner": "string", "pain_tags": ["string"] }
```

#### OpportunityOutput (Agent A)

```json
{ "directions": [Direction, Direction, Direction] }
```

#### Paths (local constant; no backend needed)

```json
{
  "paths": [
    { "id": "pathA", "name": "功能定义路径", "focus": "做什么" },
    { "id": "pathB", "name": "决策压缩路径", "focus": "不做什么" },
    { "id": "pathC", "name": "快速验证路径", "focus": "最小可演示" }
  ]
}
```

#### Feasibility Plan (Agent B)

```json
{
  "id": "plan1",
  "name": "string",
  "summary": "string",
  "score_overall": 8.2,
  "scores": {
    "technical_feasibility": 8.5,
    "market_viability": 7.8,
    "execution_risk": 8.1
  },
  "reasoning": {
    "technical_feasibility": "string",
    "market_viability": "string",
    "execution_risk": "string"
  },
  "recommended_positioning": "string"
}
```

**Score semantics**: all 0–10, higher is better. `execution_risk` = “风险可控/低风险程度”（越高越稳）。

#### FeasibilityOutput

```json
{ "plans": [Plan, Plan, Plan] }
```

#### ScopeOutput (Agent C)

```json
{
  "in_scope": [{ "id": "f1", "title": "string", "desc": "string", "priority": "P0|P1|P2" }],
  "out_scope": [{ "id": "f9", "title": "string", "desc": "string", "reason": "string" }]
}
```

#### PRDOutput (optional Agent D)

```json
{
  "markdown": "string",
  "sections": {
    "problem_statement": "string",
    "target_user": "string",
    "core_workflow": "string",
    "mvp_scope": "string",
    "success_metrics": "string",
    "risk_analysis": "string"
  }
}
```

### 3.2 DecisionContext (stored in zustand persist)

```json
{
  "session_id": "uuid",
  "created_at": "ISO",
  "idea_seed": "string?",
  "opportunity": OpportunityOutput?,
  "selected_direction_id": "A|B|C?",
  "path_id": "pathA|pathB|pathC?",
  "feasibility": FeasibilityOutput?,
  "selected_plan_id": "string?",
  "scope": ScopeOutput?,
  "prd": PRDOutput?
}
```

**Important**: Feasibility request requires both `direction_id` and `direction_text`.
`direction_text` must be derived at request time from `opportunity.directions` using `selected_direction_id`. Do not store redundant `direction_text`.

---

## 4. Backend API

Base URL: `http://localhost:8000`

### JSON endpoints (must)

- `GET /health` → `{ "ok": true }`
- `POST /agents/opportunity`
- `POST /agents/feasibility`
- `POST /agents/scope`
- (optional) `POST /agents/prd`

### SSE endpoints (should)

- `POST /agents/opportunity/stream`
- `POST /agents/feasibility/stream`

### SSE event format (must)

- `event: progress` → `data: {"step":"...", "pct":0-100}`
- `event: partial`
  - opportunity → `data: {"direction": Direction}`
  - feasibility → `data: {"plan": Plan}`

- `event: done` → `data: {full_payload}` (OpportunityOutput / FeasibilityOutput)

### Backend dependencies (must include SSE package + type check)

`services/api/requirements.txt` must include at least:

- `fastapi`
- `uvicorn[standard]`
- `pydantic`
- `python-dotenv` (optional)
- **`sse-starlette>=1.8.0`** (required for SSE)
- **`mypy`** (required for type checking)
- Optional dev: `ruff` (lint), but not required.

### CORS (must)

In `services/api/app/main.py`:

- Add CORSMiddleware allowing `http://localhost:3000`.

---

## 5. Frontend implementation requirements

### 5.1 Store hydration (avoid Next.js App Router mismatch)

#### `lib/store.ts`

- Use `persist(..., { name: 'decisionos_context_v1', skipHydration: true })`
- Expose actions for all fields (see 1.1).

#### `components/providers/StoreHydration.tsx`

- **This file is a Client Component** (`'use client'`).
- On mount: `useDecisionStore.persist.rehydrate()`.
- On unmount: no special action.

#### `app/layout.tsx`

- layout.tsx remains a **Server Component** (do NOT add `'use client'`).
- Import and render `<StoreHydration />` inside `<body>`.

### 5.2 SSE client (POST) + AbortController (mandatory)

#### `lib/sse.ts`

- Implement `streamPost(url, payload, handlers, signal?)`.
- `signal?: AbortSignal` must be accepted and forwarded to fetch/stream lib.
- Must support:
  - cancellation (abort)
  - parsing `event:` + `data:` frames
  - calling correct handler (`onProgress`, `onPartial`, `onDone`, `onError`)

#### Call sites (IdeaCanvas + Feasibility)

- Must keep a `useRef<AbortController|null>`:
  - On submit: abort previous controller, create new controller, pass `signal`.
  - On page unmount: abort controller.

**Required UX behavior**

- Rapid double-submit does not produce duplicated bubbles/plans.
- Navigating away mid-stream does not update unmounted UI and does not continue writing into store unexpectedly.

---

## 6. UI specs

### 6.1 Home `/`

- Four entry cards:
  - Idea Canvas → `/idea-canvas`
  - Feasibility → `/feasibility`
  - Scope Freeze → `/scope-freeze`
  - PRD → `/prd`

- All non-Idea pages must have guard UI when context missing.

### 6.2 Guards (`lib/guards.ts`)

- Feasibility requires: `idea_seed`, `opportunity`, `selected_direction_id`, `path_id`
- Scope requires: `selected_plan_id` + `feasibility`
- PRD can be placeholder; if generating, require `scope`

Guard UI must be deterministic:

- short explanation + single CTA button: “Start from Idea Canvas”.

### 6.3 Idea Canvas `/idea-canvas` (no React Flow)

- Center input circle; Enter triggers submit.
- Bubble positions by trig (radius ~ 200–240px).
- Streaming:
  - prefer `/agents/opportunity/stream`, render bubbles as `partial.direction` arrives.
  - fallback to JSON endpoint.

- Interactions:
  - Hover bubble shows pain tags.
  - Click bubble:
    - call `setSelectedDirection(id)`
    - animate selected to center, fade others
    - show 3 path cards

  - Click path:
    - call `setPathChoice(path_id)`
    - navigate `/feasibility`

### 6.4 Feasibility `/feasibility`

- Guard first.
- Streaming `/agents/feasibility/stream` preferred; show cards as plans arrive.
- Hover reveals sub-scores.
- Click plan navigates `/feasibility/[id]`.

### 6.5 Feasibility detail `/feasibility/[id]`

- Show reasoning + positioning.
- Confirm button:
  - `setSelectedPlan(plan_id)`
  - navigate `/scope-freeze`

### 6.6 Scope Freeze `/scope-freeze` (dnd-kit)

- Guard first.
- Fetch `/agents/scope`.
- Two columns: IN (green) OUT (gray).
- dnd-kit must implement:
  - `onDragOver` for cross-container live migration
  - `onDragEnd` for reorder within container

- Freeze:
  - disables DnD
  - overlay animation on IN column
  - lock state is persisted in store (e.g., `scope_frozen: true` optional)

### 6.7 PRD `/prd`

- MVP acceptable: placeholder showing summary (idea seed, direction, chosen plan, in_scope list).
- Optional:
  - call `/agents/prd`
  - render markdown via `react-markdown` + `remark-gfm`
  - copy markdown button

---

## 7. Backend behavior details

### 7.1 Mock outputs (must be stable)

In `core/mock_data.py`:

- Generate deterministic outputs based on `idea_seed` (simple hash-based template selection).
- Always return exactly 3 directions / 3 plans.

### 7.2 LLM wrapper (optional for MVP, but scaffolded)

In `core/llm.py`:

- Provide `generate_json(...)` and optionally `stream_json(...)`.
- On error/timeout/invalid JSON: fallback to mock.

### 7.3 SSE implementation (FastAPI + sse-starlette)

In `routes/agents.py`:

- Use `EventSourceResponse` from `sse_starlette.sse`.
- For mock streaming:
  - yield progress
  - yield `partial` events for each item with small delay
  - yield `done`

---

## 8. Type checking (Python must)

### Requirements

- Add `mypy` to backend dependencies.
- Add `mypy.ini` (or pyproject config) with at least:
  - `python_version = 3.11`
  - `ignore_missing_imports = True` (to reduce hackathon friction)
  - check package `services/api/app`

### Enforcement

- Task 3 acceptance includes running mypy successfully.
- CI optional, but local command must exist:
  - `cd services/api && mypy app`

---

## 9. Task plan (execute in order)

### Task 1 — Bootstrap repo

1. Create structure.
2. Init Next.js app (App Router + TS) in `apps/web`.
3. Init FastAPI in `services/api`.
4. Implement `GET /health`.

**Acceptance**

- `GET /health` returns `{ok:true}`
- Home page renders

---

### Task 2 — Store + hydration fix + guards + toast

1. Implement zustand store with persist:
   - `skipHydration: true`

2. Implement `StoreHydration` (client component) calling `rehydrate()` on mount.
3. Add guard UI to Feasibility/Scope/PRD pages.
4. Add sonner toaster provider.

**Acceptance**

- Refresh with persisted data: **no hydration mismatch warnings**
- Direct open `/scope-freeze` without data shows guard UI

---

### Task 3 — Backend schemas + CORS + deps + mypy

1. Define Pydantic schemas matching frontend Zod.
2. Add CORS middleware.
3. Add `sse-starlette>=1.8.0` and `mypy` to requirements.
4. Implement JSON endpoints with deterministic mock.
5. Add `mypy.ini` and ensure `mypy app` passes.

**Acceptance**

- Browser can call backend (no CORS block)
- Endpoints return valid schema JSON
- `mypy` completes without errors (or only allowed ignores per config)

---

### Task 4 — SSE endpoints + client streaming (POST) + AbortController

1. Backend:
   - `POST /agents/opportunity/stream`
   - `POST /agents/feasibility/stream`

2. Frontend:
   - `lib/sse.ts` uses fetch-event-stream and supports AbortSignal
   - integrate into Idea Canvas and Feasibility list
   - fallback to JSON on stream failure

**Acceptance**

- Bubbles/plans appear sequentially via stream
- **Rapid double submit** does not duplicate or interleave results (previous request aborted)
- Leaving page mid-stream aborts request (no unmounted setState warnings, no late store writes)

---

### Task 5 — Idea Canvas UI (Framer Motion absolute)

1. Center input + pulse animation.
2. Bubble trig coordinates.
3. Hover tags.
4. Click bubble:
   - `setSelectedDirection(id)`

5. Click path:
   - `setPathChoice(path_id)`
   - navigate feasibility

6. Ensure abort logic on submit/unmount is present.

**Acceptance**

- direction selection stored; feasibility request has required fields
- double Enter safe; back navigation safe

---

### Task 6 — Feasibility pages (cards + detail + confirm)

1. List page fetches/streams plans.
2. Hover expands dimension scores.
3. Detail page renders reasoning + positioning.
4. Confirm saves selected plan and navigates.

**Acceptance**

- End-to-end from Idea → Feasibility → Confirm works reliably

---

### Task 7 — Scope Freeze (dnd-kit with onDragOver)

1. Two containers + sortable items.
2. Must implement `onDragOver` cross-container live movement.
3. `onDragEnd` reorder within container.
4. Freeze locks DnD + overlay animation.

**Acceptance**

- During drag (before drop), item visibly enters target column
- Freeze locks state and persists until refresh

---

### Task 8 — PRD page (placeholder; optional markdown)

1. Placeholder shows context summary.
2. Optional: generate markdown, render, copy button.

**Acceptance**

- PRD page never blank; demo flow ends cleanly

---

## 10. Demo script (recommended)

1. Home → Idea Canvas
2. Enter seed
3. Watch 3 bubbles appear sequentially
4. Hover pain tags, select bubble
5. Select path
6. Watch Top3 plans appear sequentially
7. Open detail, Confirm
8. Drag 1–2 scope items across columns (live movement), Freeze
9. PRD placeholder (or markdown)

---

## 11. Hard constraints checklist (must pass)

- [ ] No React Flow
- [ ] No react-beautiful-dnd
- [ ] Zustand persist uses `skipHydration: true` and manual rehydrate via `StoreHydration`
- [ ] `layout.tsx` remains Server Component (no `'use client'`); only StoreHydration is client
- [ ] SSE client does not use native EventSource; supports POST via fetch-event-stream
- [ ] SSE supports AbortController (double submit + unmount cancel)
- [ ] SSE routes use `/stream` subpath (no `:stream`)
- [ ] FastAPI has CORS configured
- [ ] Backend dependencies include `sse-starlette`
- [ ] Python type checking exists and is runnable (mypy)
