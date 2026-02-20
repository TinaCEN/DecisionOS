# Idea Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hard-delete for ideas — a trash-icon button on each idea card with inline double-confirm, backed by a `DELETE /ideas/{idea_id}` endpoint that removes the idea row plus all associated `idea_nodes` and `idea_paths` in a single DB transaction.

**Architecture:** Backend adds `repo_ideas.delete_idea()` (transaction: delete nodes → paths → idea) and a `DELETE /ideas/{idea_id}` route returning 204. Frontend adds `deleteIdea()` to the API client and Zustand store, then renders a trash button on `IdeasDashboard` cards that flips the card inline to a confirm/cancel state before calling the API.

**Tech Stack:** FastAPI · SQLite · pytest · Next.js · Zustand · Tailwind CSS · TypeScript

---

## Boundaries (DO NOT change)

- Do **not** touch `idea_nodes`, `idea_paths`, or any other route — only add the delete path.
- Do **not** add a soft-delete or archive path — the existing `status='archived'` pattern is separate and untouched.
- Do **not** add a modal dialog — use inline card-flip confirmation only.

---

## Task 1: Backend — `repo_ideas.delete_idea()`

**Files:**
- Modify: `backend/app/db/repo_ideas.py`
- Test: `backend/tests/test_ideas_repo.py` (extend existing file, or create if absent)

**Step 1: Write the failing test**

Add to `backend/tests/test_ideas_repo.py` (or create it):

```python
# backend/tests/test_ideas_repo.py  (add these tests)
import os
import pytest
from app.db.bootstrap import initialize_database, get_default_workspace_id
from app.db.repo_ideas import IdeaRepository
from app.db import repo_dag


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    os.environ["DECISIONOS_DB_PATH"] = str(tmp_path / "test.db")
    from app.core.settings import get_settings
    get_settings.cache_clear()
    initialize_database()


def _make_idea():
    repo = IdeaRepository()
    ws_id = get_default_workspace_id()
    return repo.create_idea(workspace_id=ws_id, title="Test Idea", idea_seed="seed")


def test_delete_idea_removes_row():
    repo = IdeaRepository()
    idea = _make_idea()
    repo.delete_idea(idea.id)
    assert repo.get_idea(idea.id) is None


def test_delete_idea_cascades_nodes_and_paths():
    repo = IdeaRepository()
    idea = _make_idea()
    # Create a node and a path
    node = repo_dag.create_node(idea_id=idea.id, content="root")
    repo_dag.create_path(
        idea_id=idea.id,
        node_chain=[node.id],
        path_md="# Path",
        path_json='{"node_chain":[]}',
    )
    # Verify they exist
    assert len(repo_dag.list_nodes(idea.id)) == 1
    assert repo_dag.get_latest_path(idea.id) is not None
    # Delete idea
    repo.delete_idea(idea.id)
    # Verify cascade
    assert repo.get_idea(idea.id) is None
    assert repo_dag.list_nodes(idea.id) == []
    assert repo_dag.get_latest_path(idea.id) is None


def test_delete_idea_not_found_raises():
    repo = IdeaRepository()
    with pytest.raises(KeyError):
        repo.delete_idea("nonexistent-id")
```

**Step 2: Run — expect FAIL**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/backend
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest tests/test_ideas_repo.py -v -k "delete" 2>&1 | tail -20
```

Expected: `AttributeError: 'IdeaRepository' object has no attribute 'delete_idea'`

**Step 3: Implement `delete_idea` in `backend/app/db/repo_ideas.py`**

Find the `IdeaRepository` class and add this method (after `get_idea`):

```python
def delete_idea(self, idea_id: str) -> None:
    """Hard-delete idea and all associated nodes/paths. Raises KeyError if not found."""
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM ideas WHERE id = ?", (idea_id,)).fetchone()
        if row is None:
            raise KeyError(f"Idea {idea_id!r} not found")
        conn.execute("DELETE FROM idea_nodes WHERE idea_id = ?", (idea_id,))
        conn.execute("DELETE FROM idea_paths WHERE idea_id = ?", (idea_id,))
        conn.execute("DELETE FROM ideas WHERE id = ?", (idea_id,))
```

Note: `get_connection()` uses SQLite's implicit transaction — all three DELETEs are committed together or rolled back together.

**Step 4: Run — expect PASS**

```bash
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest tests/test_ideas_repo.py -v -k "delete" 2>&1 | tail -20
```

Expected: 3 tests PASS.

**Step 5: Run full suite — must stay green**

```bash
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest -v 2>&1 | tail -20
```

**Step 6: Commit**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete
git add backend/app/db/repo_ideas.py backend/tests/test_ideas_repo.py
git commit -m "feat(db): add IdeaRepository.delete_idea with cascade"
```

---

## Task 2: Backend — `DELETE /ideas/{idea_id}` route

**Files:**
- Modify: `backend/app/routes/ideas.py`
- Test: `backend/tests/test_ideas_api.py` (extend existing file)

**Step 1: Write the failing tests**

Open `backend/tests/test_ideas_api.py` and add at the bottom:

```python
def test_delete_idea_returns_204(client, idea_id):
    r = client.delete(f"/ideas/{idea_id}")
    assert r.status_code == 204
    assert r.content == b""


def test_delete_idea_removes_from_list(client, idea_id):
    client.delete(f"/ideas/{idea_id}")
    r = client.get("/ideas")
    ids = [i["id"] for i in r.json()["items"]]
    assert idea_id not in ids


def test_delete_idea_not_found_returns_404(client):
    r = client.delete("/ideas/nonexistent-id")
    assert r.status_code == 404


def test_delete_idea_get_returns_404_after_delete(client, idea_id):
    client.delete(f"/ideas/{idea_id}")
    r = client.get(f"/ideas/{idea_id}")
    assert r.status_code == 404
```

Check how the existing test file defines `client` and `idea_id` fixtures — use the same pattern. If no `idea_id` fixture exists yet, add one:

```python
@pytest.fixture
def idea_id(client):
    from app.db.bootstrap import get_default_workspace_id
    ws_id = get_default_workspace_id()
    r = client.post("/ideas", json={"workspace_id": ws_id, "title": "Delete Me", "idea_seed": "test"})
    return r.json()["id"]
```

**Step 2: Run — expect FAIL**

```bash
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest tests/test_ideas_api.py -v -k "delete" 2>&1 | tail -20
```

Expected: `405 Method Not Allowed` (route doesn't exist yet).

**Step 3: Add the DELETE route to `backend/app/routes/ideas.py`**

Find the router and add after the existing PATCH routes:

```python
@router.delete("/{idea_id}", status_code=204)
async def delete_idea(idea_id: str) -> None:
    try:
        _repo.delete_idea(idea_id)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail={"code": "IDEA_NOT_FOUND", "message": f"Idea {idea_id} not found"},
        )
```

**Step 4: Run — expect PASS**

```bash
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest tests/test_ideas_api.py -v -k "delete" 2>&1 | tail -20
```

**Step 5: Run full suite**

```bash
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest -v 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add backend/app/routes/ideas.py backend/tests/test_ideas_api.py
git commit -m "feat(api): add DELETE /ideas/{idea_id} endpoint"
```

---

## Task 3: Frontend — API client + Zustand store

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/ideas-store.ts`

No automated tests for these — covered by the E2E flow in Task 4.

**Step 1: Add `deleteIdea` to `frontend/lib/api.ts`**

Find the file and add after `patchIdea`:

```typescript
export async function deleteIdea(ideaId: string): Promise<void> {
  const r = await fetch(buildApiUrl(`/ideas/${ideaId}`), { method: 'DELETE' })
  if (!r.ok) throw new Error(await r.text())
}
```

**Step 2: Add `deleteIdea` action to `frontend/lib/ideas-store.ts`**

In the Zustand store, add to the interface and implementation:

```typescript
// Add to interface:
deleteIdea: (ideaId: string) => Promise<void>

// Add to store implementation (alongside other actions):
deleteIdea: async (ideaId) => {
  await deleteIdea(ideaId)   // imported from api.ts
  set((s) => ({ ideas: s.ideas.filter((i) => i.id !== ideaId) }))
},
```

Make sure `deleteIdea` is imported at the top of `ideas-store.ts`:
```typescript
import { ..., deleteIdea } from './api'
```

**Step 3: Type-check**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/frontend
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

**Step 4: Commit**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete
git add frontend/lib/api.ts frontend/lib/ideas-store.ts
git commit -m "feat(store): add deleteIdea to API client and Zustand store"
```

---

## Task 4: Frontend — Delete button with inline double-confirm

**Files:**
- Modify: `frontend/components/ideas/IdeasDashboard.tsx`

**What to build:**

Each idea card gets a trash icon (top-right corner). When clicked:
1. Card enters `confirming` state — shows "Delete this idea? This cannot be undone." with **Cancel** and **Delete** buttons
2. Cancel → back to normal card view
3. Delete → calls `store.deleteIdea(idea.id)`, card disappears from list

Use local component state (`useState`) for the confirming set — no store changes needed.

**Step 1: Read the current file first**

```bash
cat /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/frontend/components/ideas/IdeasDashboard.tsx
```

**Step 2: Implement**

Add `useState` import if not already present. Add this state at the top of the dashboard component:

```typescript
const [confirmingId, setConfirmingId] = useState<string | null>(null)
```

For each idea card in the grid, wrap the existing card content in a relative container and add:

```tsx
{/* Trash button — top-right of card */}
<button
  onClick={(e) => { e.stopPropagation(); setConfirmingId(idea.id) }}
  className="absolute right-3 top-3 rounded p-1 text-[#475569] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
  aria-label="Delete idea"
>
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

Make the card wrapper `relative` and add `group` to enable the `group-hover:opacity-100` show-on-hover behavior.

When `confirmingId === idea.id`, replace the card body with the confirm overlay:

```tsx
{confirmingId === idea.id ? (
  <div className="flex flex-col gap-3 p-4">
    <p className="text-sm text-[#F8FAFC]">Delete <span className="font-semibold">{idea.title}</span>?</p>
    <p className="text-xs text-[#64748B]">This cannot be undone. All nodes and paths will be removed.</p>
    <div className="flex gap-2">
      <button
        onClick={() => setConfirmingId(null)}
        className="flex-1 rounded-lg border border-[#334155] py-2 text-sm text-[#94A3B8] hover:border-[#475569]"
      >
        Cancel
      </button>
      <button
        onClick={async () => {
          await store.deleteIdea(idea.id)
          setConfirmingId(null)
        }}
        className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        Delete
      </button>
    </div>
  </div>
) : (
  /* existing card content here */
)}
```

**Step 3: Type-check**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/frontend
pnpm tsc --noEmit 2>&1 | head -30
```

**Step 4: Commit**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete
git add frontend/components/ideas/IdeasDashboard.tsx
git commit -m "feat(ui): add idea delete button with inline double-confirm"
```

---

## Task 5: Verification

**Step 1: Run full backend test suite**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/backend
UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest -v 2>&1 | tail -30
```

Expected: all tests PASS.

**Step 2: Frontend type-check**

```bash
cd /Users/efan404/Codes/indie_dev/pm-cursor-idea-delete/frontend
pnpm tsc --noEmit
```

Expected: 0 errors.

**Step 3: Manual smoke test**

Start backend (`uv run uvicorn app.main:app --reload --port 8000`) and frontend (`pnpm dev`), then:

1. Create a new idea → appears in the list
2. Hover over card → trash icon appears
3. Click trash → card shows "Delete this idea?" confirmation
4. Click Cancel → card returns to normal
5. Click trash again → click Delete → card disappears from list
6. `GET /ideas` → idea is gone
7. `GET /ideas/{deleted_id}` → 404

---

## Running the project

```bash
# Backend
cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend && pnpm dev

# Backend tests
cd backend && UV_CACHE_DIR=../.uv-cache uv run --python .venv/bin/python pytest -v
```
