from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.feasibility import ConfirmedDAGContextInput
from app.schemas.scope import ScopeOutput


class PRDSections(BaseModel):
    problem_statement: str
    target_user: str
    core_workflow: str
    mvp_scope: str
    success_metrics: str
    risk_analysis: str


class PRDInput(ConfirmedDAGContextInput):
    idea_seed: str = Field(min_length=1)
    selected_plan_id: str = Field(min_length=1)
    scope: ScopeOutput


class PRDOutput(BaseModel):
    markdown: str
    sections: PRDSections
