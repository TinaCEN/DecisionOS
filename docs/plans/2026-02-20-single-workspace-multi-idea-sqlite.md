# DecisionOS Single-Workspace Multi-Idea (SQLite) Design

> **For Claude/Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade DecisionOS from single in-memory idea context to persistent single-user, single-workspace, multi-idea architecture on SQLite, while preserving current step-by-step UX.

**Architecture:** Keep one default workspace for now, make `idea` the first-class aggregate, persist each idea's full decision context in SQLite JSON, and evolve API/route/state to be `idea_id` scoped. Reserve storage/contract surface for future semantic retrieval across ideas.

**Tech Stack:** Next.js App Router + Zustand + FastAPI + Pydantic + SQLite (SQLModel/SQLAlchemy) + Alembic (or sqlite init migration) + optional vector-ready metadata fields.

---

## 1. Product Scope and Constraints

### 1.1 Current Product Reality

- One user assumption.
- One workspace assumption.
- Multiple ideas must exist concurrently.
- Each idea has independent progress across Idea Canvas -> Feasibility -> Scope Freeze -> PRD.

### 1.2 Non-goals (This Iteration)

- Multi-user auth and RBAC.
- Cross-workspace switching UI.
- Full vector DB integration.
- Real-time collaborative editing.

### 1.3 Must-have Outcomes

- Users can create, list, select, rename, archive ideas.
- Idea state survives browser refresh and backend restart.
- All existing generation endpoints can target a specific idea.
- Frontend no longer relies on a single global `context` object as source of truth.

---

## 2. Domain Model

### 2.1 Aggregates

#### Workspace

- `id` (TEXT PK)
- `name` (TEXT, default: "Default Workspace")
- `created_at` (TEXT ISO8601)
- `updated_at` (TEXT ISO8601)

Only one row is required now, but model remains extensible.

#### Idea

- `id` (TEXT PK, UUID)
- `workspace_id` (TEXT FK -> workspace.id)
- `title` (TEXT, user-editable)
- `idea_seed` (TEXT nullable; denormalized quick list preview)
- `stage` (TEXT enum: `idea_canvas|feasibility|scope_freeze|prd`)
- `status` (TEXT enum: `draft|active|frozen|archived`)
- `context_json` (TEXT JSON, full DecisionContext snapshot)
- `version` (INTEGER, optimistic concurrency)
- `created_at` (TEXT ISO8601)
- `updated_at` (TEXT ISO8601)
- `archived_at` (TEXT nullable)

Archive canonical rule:

- `status` is the single archive source of truth.
- `status == archived` => `archived_at` must be non-null.
- `status != archived` => `archived_at` must be null.

### 2.2 Future-facing Extension Tables

#### IdeaEmbedding (reserved)

- `id` (TEXT PK)
- `idea_id` (TEXT FK)
- `chunk_type` (TEXT: `seed|direction|plan|scope|prd_section`)
- `chunk_text` (TEXT)
- `embedding_ref` (TEXT nullable; pointer to vector provider key)
- `created_at` (TEXT ISO8601)

This table allows a later migration to pgvector/Chroma/Qdrant without changing idea contracts.

#### IdeaRelation (optional, reserved)

- `id` (TEXT PK)
- `source_idea_id` (TEXT FK)
- `target_idea_id` (TEXT FK)
- `relation_type` (TEXT: `duplicate|inspired_by|depends_on|merged_into`)
- `score` (REAL nullable)

Useful for future cross-idea reasoning and merge UX.

---

## 3. Backend Design (FastAPI + SQLite)

### 3.1 Persistence Layer

Add `backend/app/db/`:

- `engine.py`: sqlite engine/session factory.
- `models.py`: SQLAlchemy/SQLModel definitions for Workspace/Idea.
- `repo_ideas.py`: CRUD and list queries.
- `bootstrap.py`: ensure default workspace exists.

Use SQLite pragmas:

- `journal_mode=WAL`
- `foreign_keys=ON`

### 3.2 API Surface

#### Workspace endpoints

- `GET /workspaces/default`

#### Idea lifecycle endpoints

- `GET /ideas?status=draft|active|frozen|archived&limit=50&cursor=...`
  - `status` omitted => default `draft,active,frozen`
  - sort order: `updated_at DESC, id DESC`
  - cursor format: base64url(`updated_at|id`)
  - max `limit`: 50
- `POST /ideas`
  - body: `{ "title": "...", "idea_seed": "..."? }`
  - creates idea with canonical default `context_json`:
    - `session_id` (uuid)
    - `created_at` (ISO8601)
    - `scope_frozen` (`false`)
    - `context_schema_version` (`1`)
- `GET /ideas/{idea_id}`
- `PATCH /ideas/{idea_id}`
  - body partial: `title`, `status`, `version`
  - server derives `archived_at` from `status` invariant.
- `PATCH /ideas/{idea_id}/context`
  - body: `{ "context": DecisionContext, "version": number }`
  - optimistic lock: reject stale version with `409`.

#### Agent endpoints (idea-scoped)

Use route-scoped `idea_id` only (do not duplicate `idea_id` in body):

- `POST /ideas/{idea_id}/agents/opportunity`
- `POST /ideas/{idea_id}/agents/opportunity/stream`
- `POST /ideas/{idea_id}/agents/feasibility`
- `POST /ideas/{idea_id}/agents/feasibility/stream`
- `POST /ideas/{idea_id}/agents/scope`
- `POST /ideas/{idea_id}/agents/prd`

JSON agent request contract:

- body extends existing payload with `version: number`.

JSON agent response contract (single shape):

```json
{
  "idea_id": "uuid",
  "idea_version": 12,
  "data": {}
}
```

`data` keeps existing output schema (`OpportunityOutput`, `FeasibilityOutput`, `ScopeOutput`, `PRDOutput`).

SSE contract:

- `event: progress` -> `{ "step": "...", "pct": 0-100 }`
- `event: partial` -> existing partial payload shape
- `event: done` -> `{ "idea_id": "uuid", "idea_version": 12, "data": { ...full_output } }`
- `event: error` -> `{ "code": "...", "message": "..." }`

SSE persistence rule:

- never persist on `partial`
- persist once on `done`, then bump `idea_version`
- apply compare-and-swap on `done` using request `version`; if mismatch, emit `event:error` with `IDEA_VERSION_CONFLICT` and skip persist.

Behavior:

- Validate idea exists and not archived.
- Validate optimistic lock using `version` for every mutating endpoint (including agent endpoints).
- Generate output with existing mock/model logic.
- Persist updated `context_json` + bump `version`.
- Return the fixed envelope above.

### 3.3 Error Contract

- `404 IDEA_NOT_FOUND`
- `409 IDEA_VERSION_CONFLICT`
- `422 IDEA_CONTEXT_INVALID`
- `409 IDEA_ARCHIVED`

### 3.4 Schema Compatibility

- Reuse current Pydantic schemas for generation payload/output.
- Add `IdeaSummary`, `IdeaDetail`, `PatchIdeaContextRequest` schemas.
- `context_json` should validate against DecisionContext-equivalent Pydantic model on write.
- Add a typed default context factory shared by create-idea and import flows.

---

## 4. Frontend Design (Next.js + Zustand)

### 4.1 Route Model

Add idea-scoped routes:

- `/ideas`
- `/ideas/[ideaId]/idea-canvas`
- `/ideas/[ideaId]/feasibility`
- `/ideas/[ideaId]/scope-freeze`
- `/ideas/[ideaId]/prd`

Current non-scoped routes can temporarily redirect to the latest active idea.

### 4.2 Information Architecture

#### Ideas Dashboard

- Search/filter/sort list by `updated_at`, `status`.
- Quick actions: create, rename, archive/unarchive.
- Card metadata: stage badge, updated time, brief seed preview.

#### App Shell

- Keep stepper UX.
- Add `Idea Switcher` (combobox/dropdown) in header.
- Stepper and sidebar always reflect selected idea context.

### 4.3 Store Refactor

Replace singleton context store with:

- `activeIdeaId`
- `ideaMap: Record<IdeaId, IdeaSummary>`
- `contextByIdeaId: Record<IdeaId, DecisionContext>` (optional local cache)
- async actions:
  - `loadIdeas()`
  - `createIdea()`
  - `selectIdea(ideaId)`
  - `saveContext(ideaId, context, version)`

Source of truth becomes backend; local persist only caches lightweight UI state (e.g., last selected idea id).

### 4.4 Interaction Rules

- Any mutation requires `activeIdeaId`.
- Navigating to another idea never mutates current idea's context.
- Archive action hides idea from default active list but keeps data queryable.

---

## 5. Multi-Idea Interaction and Semantic Search Readiness

### 5.1 Contract-level Preparation

For each major generation output, produce optional normalized text chunks:

- `seed_chunk`
- `direction_chunks[]`
- `plan_chunks[]`
- `scope_chunks[]`
- `prd_chunks[]`

Store with stable IDs and timestamps so an embedding worker can process incrementally.

### 5.2 Async Indexing Hook

After idea context update:

- emit domain event `IDEA_CONTEXT_UPDATED` (DB table or in-process hook for now).
- worker can later consume event and write embeddings externally.

### 5.3 Query Surface (future)

Design reserved endpoint signature now (can return 501 initially):

- `POST /ideas/search-semantic`
  - body: `{ "query": "...", "top_k": 10, "include_archived": false }`

This avoids breaking clients when vector search is added later.

---

## 6. Data Migration Strategy

### 6.1 Phase 1 (No data loss requirement)

- Introduce SQLite and idea tables.
- Keep legacy frontend routes operational.
- On first app load, auto-create one default idea if table empty.

### 6.2 Phase 2 (Legacy localStorage bridge)

- If legacy `decisionos_context_v1` exists and DB has no ideas for this user, show one-time import CTA.
- Import creates a new idea from old context.

### 6.3 Phase 3

- Remove singleton-context-only assumptions from UI and docs.

---

## 7. Validation and Testing Plan

### 7.1 Backend

- Unit tests for repo CRUD and optimistic locking.
- API tests:
  - create/list/get/patch idea
  - patch context success and conflict
  - idea-scoped agent endpoints persist results

### 7.2 Frontend

- Integration tests:
  - create two ideas, progress each independently
  - switch idea and ensure state isolation
  - archive/unarchive behaviors

### 7.3 E2E

- user creates `Idea A` and `Idea B`
- completes Feasibility in A
- completes Scope in B
- refresh browser
- both stages persist correctly

---

## 8. Implementation Tasks (Recommended Order)

### Task 1: Add SQLite foundation in backend

- Create DB engine/session/models/bootstrap.
- Verify default workspace bootstrap.

### Task 2: Add idea CRUD endpoints

- Implement schemas + repository + routes.
- Add API tests.

### Task 3: Add context patch endpoint with versioning

- Validate DecisionContext shape server-side.
- Add conflict tests.

### Task 4: Scope existing agent routes by `idea_id`

- Persist outputs into `context_json`.
- Keep existing generation functions unchanged.

### Task 5: Frontend ideas dashboard + idea-scoped routing

- Add `/ideas` and `[ideaId]` route structure.
- Add idea switcher in shell.

### Task 6: Store refactor to backend-sourced idea state

- Introduce async actions and minimal local cache.

### Task 7: Legacy import bridge (optional but recommended)

- One-time import from old localStorage key.

### Task 8: Semantic-search reserve contracts

- Add event hook and placeholder endpoint returning `501`.

---

## 9. Acceptance Criteria

- System supports multiple ideas under one workspace with isolated progress.
- Idea lifecycle operations (create/list/select/rename/archive) work end-to-end.
- Agent generation writes to the correct idea context in SQLite.
- Frontend survives refresh without losing idea progress.
- Architecture leaves clear extension seam for vector semantic retrieval.
