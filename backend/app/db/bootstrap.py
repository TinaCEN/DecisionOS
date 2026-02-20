from __future__ import annotations

import sqlite3

from app.core.time import utc_now_iso
from app.db.engine import db_session
from app.db.models import SCHEMA_STATEMENTS
from app.db.repo_ai import ensure_default_ai_settings

DEFAULT_WORKSPACE_ID = "default"
DEFAULT_WORKSPACE_NAME = "Default Workspace"


def initialize_database() -> None:
    with db_session() as connection:
        for statement in SCHEMA_STATEMENTS:
            connection.execute(statement)
        ensure_default_workspace(connection)
        ensure_default_ai_settings(connection)


def ensure_default_workspace(connection: sqlite3.Connection) -> None:
    now = utc_now_iso()
    connection.execute(
        """
        INSERT INTO workspace (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
        """,
        (DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME, now, now),
    )
