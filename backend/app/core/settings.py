from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

LLMMode = Literal["mock", "modelscope", "auto"]


@dataclass(frozen=True)
class Settings:
    app_name: str
    llm_mode: LLMMode
    cors_origins: tuple[str, ...]
    db_path: str
    secret_key: str
    auth_disabled: bool
    auth_session_ttl_seconds: int
    seed_admin_username: str
    seed_admin_password: str
    seed_test_username: str
    seed_test_password: str


def _parse_cors_origins(raw: str | None) -> tuple[str, ...]:
    defaults = ("http://localhost:3000", "http://127.0.0.1:3000")
    if raw is None or not raw.strip():
        return defaults

    configured = [origin.strip() for origin in raw.split(",") if origin.strip()]
    merged: list[str] = []
    for origin in [*configured, *defaults]:
        if origin not in merged:
            merged.append(origin)
    return tuple(merged) if merged else defaults


def _parse_bool(raw: str | None, *, default: bool) -> bool:
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_int(raw: str | None, *, default: int, minimum: int) -> int:
    if raw is None:
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        return default
    return value if value >= minimum else default


class ConfigurationError(Exception):
    """Raised when a required configuration is missing or invalid."""

    pass


def _require_env(name: str) -> str:
    """Require an environment variable to be set."""
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigurationError(
            f"Required environment variable '{name}' is not set. "
            f"Please set it before starting the application."
        )
    return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw_mode = os.getenv("LLM_MODE", "auto").strip().lower()
    if raw_mode == "modelscope":
        llm_mode: LLMMode = "modelscope"
    elif raw_mode == "mock":
        llm_mode = "mock"
    else:
        llm_mode = "auto"

    # Admin credentials are required - must be set via environment variables
    seed_admin_username = _require_env("DECISIONOS_SEED_ADMIN_USERNAME")
    seed_admin_password = _require_env("DECISIONOS_SEED_ADMIN_PASSWORD")

    return Settings(
        app_name="DecisionOS API",
        llm_mode=llm_mode,
        cors_origins=_parse_cors_origins(os.getenv("DECISIONOS_CORS_ORIGINS")),
        db_path=os.getenv("DECISIONOS_DB_PATH", "./decisionos.db").strip() or "./decisionos.db",
        secret_key=(
            os.getenv("DECISIONOS_SECRET_KEY", "").strip()
            or "decisionos-dev-secret-change-me"
        ),
        auth_disabled=_parse_bool(os.getenv("DECISIONOS_AUTH_DISABLED"), default=False),
        auth_session_ttl_seconds=_parse_int(
            os.getenv("DECISIONOS_AUTH_SESSION_TTL_SECONDS"),
            default=43200,
            minimum=300,
        ),
        seed_admin_username=seed_admin_username,
        seed_admin_password=seed_admin_password,
        seed_test_username=os.getenv("DECISIONOS_SEED_TEST_USERNAME", "test").strip() or "test",
        seed_test_password=os.getenv("DECISIONOS_SEED_TEST_PASSWORD", "test").strip() or "test",
    )
