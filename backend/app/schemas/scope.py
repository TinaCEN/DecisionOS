from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import DirectionId, PathId, PriorityLevel
from app.schemas.feasibility import FeasibilityOutput


class InScopeItem(BaseModel):
    id: str
    title: str
    desc: str
    priority: PriorityLevel


class OutScopeItem(BaseModel):
    id: str
    title: str
    desc: str
    reason: str


class ScopeInput(BaseModel):
    idea_seed: str = Field(min_length=1)
    direction_id: DirectionId
    direction_text: str = Field(min_length=1)
    path_id: PathId
    selected_plan_id: str = Field(min_length=1)
    feasibility: FeasibilityOutput


class ScopeOutput(BaseModel):
    in_scope: list[InScopeItem]
    out_scope: list[OutScopeItem]
