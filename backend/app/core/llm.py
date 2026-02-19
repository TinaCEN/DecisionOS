from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from app.core import mock_data
from app.core.settings import get_settings
from app.schemas.feasibility import FeasibilityInput, FeasibilityOutput
from app.schemas.idea import OpportunityInput, OpportunityOutput
from app.schemas.prd import PRDInput, PRDOutput
from app.schemas.scope import ScopeInput, ScopeOutput

SchemaT = TypeVar("SchemaT")


def generate_json(
    *,
    mock_factory: Callable[[], SchemaT],
    model_factory: Callable[[], SchemaT] | None = None,
) -> SchemaT:
    settings = get_settings()
    if settings.llm_mode == "modelscope" and model_factory is not None:
        try:
            return model_factory()
        except Exception:
            pass
    return mock_factory()


def generate_opportunity(payload: OpportunityInput) -> OpportunityOutput:
    return generate_json(
        mock_factory=lambda: mock_data.generate_opportunity_output(payload.idea_seed)
    )


def generate_feasibility(payload: FeasibilityInput) -> FeasibilityOutput:
    return generate_json(mock_factory=lambda: mock_data.generate_feasibility_output(payload))


def generate_scope(payload: ScopeInput) -> ScopeOutput:
    return generate_json(mock_factory=lambda: mock_data.generate_scope_output(payload))


def generate_prd(payload: PRDInput) -> PRDOutput:
    return generate_json(mock_factory=lambda: mock_data.generate_prd_output(payload))
