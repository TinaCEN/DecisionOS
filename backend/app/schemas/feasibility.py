from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import DirectionId, PathId, ReasoningBreakdown, ScoreBreakdown


class FeasibilityInput(BaseModel):
    idea_seed: str = Field(min_length=1)
    direction_id: DirectionId
    direction_text: str = Field(min_length=1)
    path_id: PathId


class Plan(BaseModel):
    id: str
    name: str
    summary: str
    score_overall: float = Field(ge=0, le=10)
    scores: ScoreBreakdown
    reasoning: ReasoningBreakdown
    recommended_positioning: str


class FeasibilityOutput(BaseModel):
    plans: list[Plan] = Field(min_length=3, max_length=3)
