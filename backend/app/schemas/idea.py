from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Direction

OPPORTUNITY_MIN_COUNT = 1
OPPORTUNITY_MAX_COUNT = 6
OPPORTUNITY_DEFAULT_COUNT = 3


class OpportunityInput(BaseModel):
    idea_seed: str = Field(min_length=1)
    count: int = Field(
        default=OPPORTUNITY_DEFAULT_COUNT,
        ge=OPPORTUNITY_MIN_COUNT,
        le=OPPORTUNITY_MAX_COUNT,
    )


class OpportunityOutput(BaseModel):
    directions: list[Direction] = Field(min_length=OPPORTUNITY_MIN_COUNT, max_length=OPPORTUNITY_MAX_COUNT)
