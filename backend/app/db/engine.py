from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from app.core.settings import get_settings


def _resolve_db_path() -> str:
    raw_path = get_settings().db_path
    if raw_path == ":memory:":
        return raw_path

    resolved = Path(raw_path)
    if not resolved.is_absolute():
        resolved = Path.cwd() / resolved

    resolved.parent.mkdir(parents=True, exist_ok=True)
    return str(resolved)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(_resolve_db_path(), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    connection.execute("PRAGMA journal_mode = WAL;")
    return connection


@contextmanager
def db_session() -> Iterator[sqlite3.Connection]:
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
