from __future__ import annotations

SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS workspace (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS idea (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        idea_seed TEXT,
        stage TEXT NOT NULL CHECK (stage IN ('idea_canvas', 'feasibility', 'scope_freeze', 'prd')),
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'frozen', 'archived')),
        context_json TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY (workspace_id) REFERENCES workspace(id),
        CHECK (
            (status = 'archived' AND archived_at IS NOT NULL)
            OR
            (status != 'archived' AND archived_at IS NULL)
        )
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_idea_updated
    ON idea(updated_at DESC, id DESC);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_idea_status_updated
    ON idea(status, updated_at DESC, id DESC);
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_settings (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
)
