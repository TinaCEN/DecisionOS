from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import Direction


class OpportunityInput(BaseModel):
    idea_seed: str = Field(min_length=1)


class OpportunityOutput(BaseModel):
    directions: list[Direction] = Field(min_length=3, max_length=3)
