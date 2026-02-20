from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import PriorityLevel
from app.schemas.feasibility import ConfirmedDAGContextInput, FeasibilityOutput


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


class ScopeInput(ConfirmedDAGContextInput):
    idea_seed: str = Field(min_length=1)
    selected_plan_id: str = Field(min_length=1)
    feasibility: FeasibilityOutput


class ScopeOutput(BaseModel):
    in_scope: list[InScopeItem]
    out_scope: list[OutScopeItem]
