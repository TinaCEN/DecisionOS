from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.core import llm
from app.schemas.feasibility import FeasibilityInput, FeasibilityOutput, Plan
from app.schemas.idea import OpportunityInput, OpportunityOutput
from app.schemas.prd import PRDInput, PRDOutput
from app.schemas.scope import ScopeInput, ScopeOutput

router = APIRouter(prefix="/agents", tags=["agents"])


def _sse_event(event: str, payload: dict[str, object]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


@router.post("/opportunity", response_model=OpportunityOutput)
async def post_opportunity(payload: OpportunityInput) -> OpportunityOutput:
    return llm.generate_opportunity(payload)


@router.post("/feasibility", response_model=FeasibilityOutput)
async def post_feasibility(payload: FeasibilityInput) -> FeasibilityOutput:
    return llm.generate_feasibility(payload)


@router.post("/scope", response_model=ScopeOutput)
async def post_scope(payload: ScopeInput) -> ScopeOutput:
    return llm.generate_scope(payload)


@router.post("/prd", response_model=PRDOutput)
async def post_prd(payload: PRDInput) -> PRDOutput:
    return llm.generate_prd(payload)


@router.post("/opportunity/stream")
async def stream_opportunity(payload: OpportunityInput) -> EventSourceResponse:
    output = llm.generate_opportunity(payload)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        yield _sse_event("progress", {"step": "received_request", "pct": 5})

        for index, direction in enumerate(output.directions, start=1):
            await asyncio.sleep(0.15)
            pct = 20 + index * 25
            yield _sse_event("progress", {"step": f"direction_{index}", "pct": min(95, pct)})
            yield _sse_event("partial", {"direction": direction.model_dump()})

        yield _sse_event("done", output.model_dump())

    return EventSourceResponse(event_generator())


@router.post("/feasibility/stream")
async def stream_feasibility(payload: FeasibilityInput) -> EventSourceResponse:
    output = llm.generate_feasibility(payload)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        yield _sse_event("progress", {"step": "received_request", "pct": 5})

        for index, plan in enumerate(output.plans, start=1):
            await asyncio.sleep(0.2)
            pct = 20 + index * 25
            yield _sse_event("progress", {"step": f"plan_{index}", "pct": min(95, pct)})
            yield _sse_event("partial", {"plan": _plan_payload(plan)})

        yield _sse_event("done", output.model_dump())

    return EventSourceResponse(event_generator())


def _plan_payload(plan: Plan) -> dict[str, object]:
    return plan.model_dump()
