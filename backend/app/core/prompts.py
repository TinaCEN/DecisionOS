from __future__ import annotations

SYSTEM_PROMPT = "You are the DecisionOS backend planner."

OPPORTUNITY_PROMPT = (
    "Given an idea seed, produce exactly three opportunity directions with concise titles, "
    "one-liners, and pain tags."
)

FEASIBILITY_PROMPT = (
    "Given an idea seed, selected direction, and path, produce exactly three feasibility plans "
    "with scoring and reasoning."
)

SCOPE_PROMPT = (
    "Given a selected plan and feasibility output, classify features into in_scope and out_scope."
)

PRD_PROMPT = "Generate a concise MVP PRD markdown from approved scope."
