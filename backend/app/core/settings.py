from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

LLMMode = Literal["mock", "modelscope"]


@dataclass(frozen=True)
class Settings:
    app_name: str
    llm_mode: LLMMode
    cors_origins: tuple[str, ...]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw_mode = os.getenv("LLM_MODE", "mock").strip().lower()
    llm_mode: LLMMode = "modelscope" if raw_mode == "modelscope" else "mock"

    return Settings(
        app_name="DecisionOS API",
        llm_mode=llm_mode,
        cors_origins=("http://localhost:3000", "http://127.0.0.1:3000"),
    )
