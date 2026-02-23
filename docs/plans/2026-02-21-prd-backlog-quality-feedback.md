# PRD + Backlog Quality Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a single-call `PRD + Backlog` output with richer context grounding, remove silent PRD fallback in non-mock mode, and add latest-only user quality feedback on the final deliverable.

**Architecture:** Keep idea-scoped routes and optimistic locking as-is. PRD generation is upgraded to a strict backend-assembled context pack (Step2 + Step3 + Step4), then one structured LLM call produces both PRD and Backlog. Persist both output and latest feedback in `idea.context_json` so writes stay atomic under existing CAS version checks.

**Tech Stack:** FastAPI + Pydantic + SQLite (`idea.context_json`) + Next.js App Router + Zustand + Vitest + backend API tests.

---

## 1. Confirmed Product Decisions

### 1.1 In Scope

- PRD page is upgraded to a combined deliverable:
  - long-form PRD
  - execution-ready Backlog
- PRD endpoint returns PRD+Backlog in one request (single model call).
- PRD generation failure in non-mock mode must be explicit (no silent mock fallback).
- User can rate final output; only latest feedback is stored.

### 1.2 Out of Scope

- Backlog inline editing workflow.
- Multi-user reviewer workflow.
- Feedback history/analytics dashboard.

## 2. Data Model and Storage Strategy

### 2.1 Why keep storage in `idea.context_json`

- Existing CAS/versioning guarantees already protect all context writes.
- Avoid dual-write consistency risks between table rows and context JSON.
- Matches current architecture guardrail: backend persisted source of truth is idea-scoped context.

### 2.2 `DecisionContext` extensions

Add fields in `backend/app/schemas/ideas.py` and `frontend/lib/schemas.ts`:

- `prd_bundle?: PrdBundle`
- `prd_feedback_latest?: PrdFeedbackLatest`

Proposed shapes:

```ts
type PrdBundle = {
  baseline_id: string
  context_fingerprint: string
  generated_at: string
  generation_meta: {
    provider_id?: string
    model?: string
    confirmed_path_id: string
    selected_plan_id: string
    baseline_id: string
  }
  output: PrdOutputV2
}

type PrdFeedbackLatest = {
  baseline_id: string
  submitted_at: string
  rating_overall: 1 | 2 | 3 | 4 | 5
  rating_dimensions: {
    clarity: 1 | 2 | 3 | 4 | 5
    completeness: 1 | 2 | 3 | 4 | 5
    actionability: 1 | 2 | 3 | 4 | 5
    scope_fit: 1 | 2 | 3 | 4 | 5
  }
  comment?: string
}
```

## 3. API Contract (Single-call PRD+Backlog)

### 3.1 Request

- Route: `POST /ideas/{idea_id}/agents/prd`
- Body (minimal):
  - `version: number`
  - `baseline_id: string`

Backend assembles context from canonical sources:

- Step2: `idea_paths.latest` + `path_md` + `path_json` + confirmed leaf node
- Step3: `context.feasibility.plans[]` + `selected_plan_id` (selected plan full reasoning/scores)
- Step4: frozen baseline by `baseline_id` + mapped `context.scope` details

### 3.2 Response

- Keep envelope:
  - `{ idea_id, idea_version, data }`
- `data` becomes `PrdOutputV2`:
  - `markdown`
  - `sections` (expanded)
  - `requirements[]`
  - `backlog.items[]`
  - `generation_meta`

### 3.3 Feedback API

- New route: `POST /ideas/{idea_id}/prd/feedback`
- Body:
  - `version`
  - `baseline_id`
  - `rating_overall`
  - `rating_dimensions`
  - `comment?`
- Response:
  - `{ idea_id, idea_version, data: prd_feedback_latest }`

## 4. Prompt Design (Quality + Consistency)

### 4.1 System Prompt Intent

- Role: senior PM + delivery lead.
- Output: strict JSON schema only.
- Quality target: detailed and implementation-ready, not concise summary.

### 4.2 User Prompt Inputs

One payload object named `context_pack`:

- `idea_seed`
- `step2_path`:
  - `path_md`
  - `path_summary`
  - `leaf_node_content`
- `step3_feasibility`:
  - `selected_plan`
  - `alternatives_brief`
- `step4_scope`:
  - `in_scope`
  - `out_scope`
  - `baseline_meta`

### 4.3 Hard Output Constraints

- PRD requirements count: 6-12.
- Backlog item count: 8-15.
- Every backlog item must include:
  - `requirement_id` (trace to PRD requirement)
  - `priority` (`P0|P1|P2`)
  - `type` (`epic|story|task`)
  - `acceptance_criteria` (>=2 bullets)
  - `source_refs` (must include `step2|step3|step4` at least one)
- `out_scope` must not appear in P0 backlog.

## 5. Error Handling and Fallback Rules

- `LLM_MODE=mock`:
  - deterministic mock allowed.
- `LLM_MODE!=mock`:
  - PRD generation must be strict, no silent mock fallback.
- Provider/schema failure:
  - API `502`
  - `detail.code = PRD_GENERATION_FAILED`
  - include stable user-facing message.
- Frontend:
  - show explicit error state with retry button.
  - keep last successful `prd_bundle` visible as stale read-only block.

## 6. UI/UX Interaction Design (from UI/UX skill constraints)

### 6.1 Layout

- Desktop:
  - top metadata/status strip
  - left column: PRD sections + requirement anchors
  - right column: backlog panel with filters
- Mobile:
  - stacked sections
  - sticky tab switch (`PRD` / `Backlog` / `Feedback`)

### 6.2 Interaction Links

- Click a PRD requirement:
  - highlight mapped backlog items.
- Click a backlog item:
  - scroll/focus linked requirement.
- Backlog filters:
  - `priority`, `type`, `source_ref`.

### 6.3 Feedback UX

- Quick rating:
  - thumbs up/down.
- Expanded panel:
  - overall 1-5
  - 4 dimension ratings
  - optional comment textarea
- states:
  - idle / submitting / success / failed

### 6.4 Accessibility and responsiveness minimums

- Contrast >= 4.5:1 for body text.
- Visible focus ring for all interactive controls.
- Minimum hit area 44x44 for icon actions.
- Keyboard-complete operation for filters, rating controls, submit.

## 7. Detailed Execution Tasks

### Task 1: Define V2 PRD/Backlog schemas

**Files:**

- Modify: `backend/app/schemas/prd.py`
- Modify: `backend/app/schemas/ideas.py`
- Modify: `frontend/lib/schemas.ts`
- Test: `backend/tests/test_api_ideas_and_agents.py`
- Test: `frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 1: Write failing backend schema test**

- Add a case asserting PRD response includes `requirements` and `backlog.items`.

**Step 2: Run backend test (expect FAIL)**

- Run: `cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python -m pytest tests/test_api_ideas_and_agents.py -k prd -v`
- Expected: schema/assertion failure.

**Step 3: Implement backend schema changes**

- Add `RequirementItem`, `BacklogItem`, `BacklogOutput`, `PrdOutputV2`.
- Keep compatibility via optional legacy fields if necessary.

**Step 4: Write failing frontend parse test**

- Add test input for `PrdOutputV2` in existing PRD test file.

**Step 5: Run frontend test (expect FAIL)**

- Run: `pnpm test:web -- frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 6: Implement frontend schema updates**

- Add zod schema/types for new PRD payload.

**Step 7: Re-run tests (expect PASS)**

- Run both commands above.

**Step 8: Commit**

```bash
git add backend/app/schemas/prd.py backend/app/schemas/ideas.py frontend/lib/schemas.ts backend/tests/test_api_ideas_and_agents.py frontend/components/prd/__tests__/PrdPageBaseline.test.tsx
git commit -m "feat(prd-schema): add v2 prd+backlog output contract"
```

### Task 2: Implement backend context pack assembler

**Files:**

- Modify: `backend/app/routes/idea_agents.py`
- Modify: `backend/app/db/repo_scope.py`
- Modify: `backend/app/db/repo_dag.py` (if helper needed)
- Test: `backend/tests/test_api_ideas_and_agents.py`

**Step 1: Write failing tests for missing prerequisites**

- Missing baseline, missing selected plan, missing confirmed path should return deterministic error.

**Step 2: Run tests (expect FAIL)**

- Run: `cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python -m pytest tests/test_api_ideas_and_agents.py -k prd_context -v`

**Step 3: Implement `build_prd_context_pack(...)`**

- Input: `idea_id`, `baseline_id`.
- Output: typed pack with step2/step3/step4 data.

**Step 4: Wire PRD route to use context pack**

- Request now requires `baseline_id` + `version`.
- Remove front-end supplied raw scope dependency from route payload.

**Step 5: Re-run tests (expect PASS)**

**Step 6: Commit**

```bash
git add backend/app/routes/idea_agents.py backend/app/db/repo_scope.py backend/app/db/repo_dag.py backend/tests/test_api_ideas_and_agents.py
git commit -m "feat(prd-context): assemble step2-step4 context pack on backend"
```

### Task 3: Redesign prompt and strict generation behavior

**Files:**

- Modify: `backend/app/core/prompts.py`
- Modify: `backend/app/core/llm.py`
- Modify: `backend/app/core/ai_gateway.py` (if meta needed)
- Test: `backend/tests/test_api_ideas_and_agents.py`

**Step 1: Add failing test for non-mock strict behavior**

- In non-mock mode, provider failure should produce error response, not mock PRD.

**Step 2: Run test (expect FAIL)**

- Run: `cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python -m pytest tests/test_api_ideas_and_agents.py -k prd_generation_failed -v`

**Step 3: Implement dedicated strict function**

- Add `generate_prd_strict(payload)` in `llm.py`.
- Keep old fallback behavior for non-PRD flows.

**Step 4: Replace concise prompt with long-form contract prompt**

- Add section minimums, backlog constraints, traceability requirements.

**Step 5: Re-run tests (expect PASS)**

**Step 6: Commit**

```bash
git add backend/app/core/prompts.py backend/app/core/llm.py backend/app/core/ai_gateway.py backend/tests/test_api_ideas_and_agents.py
git commit -m "feat(prd-prompt): strict prd+backlog generation without silent fallback"
```

### Task 4: Persist `prd_bundle` and add latest-only feedback endpoint

**Files:**

- Create: `backend/app/routes/idea_prd_feedback.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas/ideas.py`
- Modify: `backend/app/db/repo_ideas.py`
- Test: `backend/tests/test_api_ideas_and_agents.py`

**Step 1: Write failing feedback API tests**

- Submit success.
- Version conflict.
- Overwrite previous feedback (latest-only semantics).

**Step 2: Run tests (expect FAIL)**

- Run: `cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python -m pytest tests/test_api_ideas_and_agents.py -k prd_feedback -v`

**Step 3: Implement feedback route and repo mutation**

- Mutate `context.prd_feedback_latest`.
- CAS version bump required.

**Step 4: Re-run tests (expect PASS)**

**Step 5: Commit**

```bash
git add backend/app/routes/idea_prd_feedback.py backend/app/main.py backend/app/schemas/ideas.py backend/app/db/repo_ideas.py backend/tests/test_api_ideas_and_agents.py
git commit -m "feat(prd-feedback): add latest-only prd quality feedback endpoint"
```

### Task 5: Frontend request/payload and stale strategy refactor

**Files:**

- Modify: `frontend/components/prd/PrdPage.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/schemas.ts`
- Test: `frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 1: Add failing tests for new request shape**

- Ensure PRD generation sends only `version + baseline_id`.

**Step 2: Run tests (expect FAIL)**

- Run: `pnpm test:web -- frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 3: Implement request refactor**

- Page no longer sends reconstructed scope payload.
- Use backend-assembled context pack path.

**Step 4: Update staleness key**

- Include `baseline_id` + `selected_plan_id` + `confirmed_path_id`.

**Step 5: Re-run tests (expect PASS)**

**Step 6: Commit**

```bash
git add frontend/components/prd/PrdPage.tsx frontend/lib/api.ts frontend/lib/schemas.ts frontend/components/prd/__tests__/PrdPageBaseline.test.tsx
git commit -m "refactor(prd-page): request prd+backlog with backend context assembly"
```

### Task 6: Build PRD+Backlog UI and feedback UX

**Files:**

- Modify: `frontend/components/prd/PrdView.tsx`
- Create: `frontend/components/prd/PrdBacklogPanel.tsx`
- Create: `frontend/components/prd/PrdFeedbackCard.tsx`
- Modify: `frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 1: Write failing UI tests**

- Backlog list renders with filters.
- Requirement-to-backlog highlight works.
- Error placeholder + retry renders.
- Feedback submit state transitions.

**Step 2: Run tests (expect FAIL)**

- Run: `pnpm test:web -- frontend/components/prd/__tests__/PrdPageBaseline.test.tsx`

**Step 3: Implement UI**

- Two-column desktop, stacked mobile.
- Accessible filters, keyboard navigation, focus states.
- Feedback widget with quick and detailed modes.

**Step 4: Re-run tests (expect PASS)**

**Step 5: Commit**

```bash
git add frontend/components/prd/PrdView.tsx frontend/components/prd/PrdBacklogPanel.tsx frontend/components/prd/PrdFeedbackCard.tsx frontend/components/prd/__tests__/PrdPageBaseline.test.tsx
git commit -m "feat(prd-ui): add linked prd and backlog views with quality feedback"
```

### Task 7: Full verification and docs sync

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md` (if endpoint contract section changes)

**Step 1: Run backend regression**

- Run: `cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python -m pytest tests/test_api_ideas_and_agents.py tests/test_scope_api.py -v`

**Step 2: Run frontend regression**

- Run: `pnpm test:web -- frontend/components/prd/__tests__/PrdPageBaseline.test.tsx frontend/components/scope/__tests__/ScopeFreezePage.test.tsx frontend/lib/__tests__/guards.scope-baseline.test.ts`

**Step 3: Lint/build smoke**

- Run: `pnpm lint:web && pnpm build:web`

**Step 4: Update docs**

- Document:
  - new PRD request/response contract
  - strict error semantics
  - latest-only feedback behavior

**Step 5: UI guidelines audit pass**

- Review files:
  - `frontend/components/prd/PrdView.tsx`
  - `frontend/components/prd/PrdBacklogPanel.tsx`
  - `frontend/components/prd/PrdFeedbackCard.tsx`
- Check:
  - keyboard focus order
  - color contrast
  - touch target size
  - error state clarity

**Step 6: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs(prd-backlog): document v2 contract and feedback behavior"
```

## 8. Done Criteria

- Single PRD API call returns complete PRD + Backlog.
- Output contains explicit requirement-to-backlog mapping.
- Step2/3/4 signals are all consumed by backend context pack.
- Non-mock mode PRD failure never silently degrades to mock.
- Feedback endpoint stores only latest feedback in context with CAS bump.
- PRD page has explicit loading/error/success states and accessible interactions.
