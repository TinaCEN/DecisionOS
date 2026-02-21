from __future__ import annotations

import asyncio
import hashlib
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.core import llm
from app.core.contexts import parse_context_strict
from app.core.time import utc_now_iso
from app.db import repo_dag
from app.db.repo_ideas import IdeaRepository, UpdateIdeaResult
from app.db.repo_scope import ScopeBaselineRecord, ScopeRepository
from app.schemas.feasibility import FeasibilityOutput, Plan
from app.schemas.idea import OpportunityOutput
from app.schemas.prd import (
    PRDOutput,
    PrdBaselineMeta,
    PrdBundle,
    PrdContextPack,
    PrdPlanBrief,
    PrdStep2Path,
    PrdStep3Feasibility,
    PrdStep4Scope,
)
from app.schemas.ideas import (
    DecisionContext,
    FeasibilityAgentResponse,
    FeasibilityIdeaRequest,
    OpportunityAgentResponse,
    OpportunityIdeaRequest,
    PRDAgentResponse,
    PRDIdeaRequest,
    ScopeAgentResponse,
    ScopeIdeaRequest,
)
from app.schemas.scope import InScopeItem, OutScopeItem, ScopeOutput

router = APIRouter(prefix="/ideas/{idea_id}/agents", tags=["idea-agents"])
_repo = IdeaRepository()
_scope_repo = ScopeRepository()


def _sse_event(event: str, payload: dict[str, object]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


@router.post("/opportunity", response_model=OpportunityAgentResponse)
async def post_opportunity(idea_id: str, payload: OpportunityIdeaRequest) -> OpportunityAgentResponse:
    output = llm.generate_opportunity(payload)
    result = _repo.apply_agent_update(
        idea_id,
        version=payload.version,
        mutate_context=lambda context: _apply_opportunity(context, payload, output),
    )
    idea_version = _unwrap_update(result)
    return OpportunityAgentResponse(idea_id=idea_id, idea_version=idea_version, data=output)


@router.post("/feasibility", response_model=FeasibilityAgentResponse)
async def post_feasibility(idea_id: str, payload: FeasibilityIdeaRequest) -> FeasibilityAgentResponse:
    output = llm.generate_feasibility(payload)
    result = _repo.apply_agent_update(
        idea_id,
        version=payload.version,
        mutate_context=lambda context: _apply_feasibility(context, payload, output),
    )
    idea_version = _unwrap_update(result)
    return FeasibilityAgentResponse(idea_id=idea_id, idea_version=idea_version, data=output)


@router.post("/scope", response_model=ScopeAgentResponse)
async def post_scope(idea_id: str, payload: ScopeIdeaRequest) -> ScopeAgentResponse:
    output = llm.generate_scope(payload)
    result = _repo.apply_agent_update(
        idea_id,
        version=payload.version,
        mutate_context=lambda context: _apply_scope(context, payload, output),
    )
    idea_version = _unwrap_update(result)
    return ScopeAgentResponse(idea_id=idea_id, idea_version=idea_version, data=output)


@router.post("/prd", response_model=PRDAgentResponse)
async def post_prd(idea_id: str, payload: PRDIdeaRequest) -> PRDAgentResponse:
    idea = _repo.get_idea(idea_id)
    if idea is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "IDEA_NOT_FOUND", "message": "Idea not found"},
        )
    if idea.status == "archived":
        raise HTTPException(
            status_code=409,
            detail={"code": "IDEA_ARCHIVED", "message": "Idea is archived"},
        )

    pack = _build_prd_context_pack(
        idea_id=idea_id,
        baseline_id=payload.baseline_id,
        context=parse_context_strict(idea.context),
    )
    fingerprint = _context_pack_fingerprint(pack)
    try:
        output = llm.generate_prd_strict(pack)
    except llm.PRDGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "PRD_GENERATION_FAILED",
                "message": "PRD generation failed. Please retry.",
            },
        ) from exc

    bundle = PrdBundle(
        baseline_id=payload.baseline_id,
        context_fingerprint=fingerprint,
        generated_at=utc_now_iso(),
        generation_meta=output.generation_meta,
        output=output,
    )
    result = _repo.apply_agent_update(
        idea_id,
        version=payload.version,
        mutate_context=lambda context: _apply_prd(context, pack, bundle),
    )
    idea_version = _unwrap_update(result)
    return PRDAgentResponse(idea_id=idea_id, idea_version=idea_version, data=output)


@router.post("/opportunity/stream")
async def stream_opportunity(idea_id: str, payload: OpportunityIdeaRequest) -> EventSourceResponse:
    output = llm.generate_opportunity(payload)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        yield _sse_event("progress", {"step": "received_request", "pct": 5})

        total = max(1, len(output.directions))
        for index, direction in enumerate(output.directions, start=1):
            await asyncio.sleep(0.15)
            pct = 10 + int((index / total) * 85)
            yield _sse_event("progress", {"step": f"direction_{index}", "pct": min(95, pct)})
            yield _sse_event("partial", {"direction": direction.model_dump()})

        result = _repo.apply_agent_update(
            idea_id,
            version=payload.version,
            mutate_context=lambda context: _apply_opportunity(context, payload, output),
        )
        error_payload = _sse_error_payload(result)
        if error_payload is not None:
            yield _sse_event("error", error_payload)
            return

        assert result.idea is not None
        yield _sse_event(
            "done",
            {
                "idea_id": idea_id,
                "idea_version": result.idea.version,
                "data": output.model_dump(),
            },
        )

    return EventSourceResponse(event_generator())


@router.post("/feasibility/stream")
async def stream_feasibility(idea_id: str, payload: FeasibilityIdeaRequest) -> EventSourceResponse:
    output = llm.generate_feasibility(payload)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        yield _sse_event("progress", {"step": "received_request", "pct": 5})

        for index, plan in enumerate(output.plans, start=1):
            await asyncio.sleep(0.2)
            pct = 20 + index * 25
            yield _sse_event("progress", {"step": f"plan_{index}", "pct": min(95, pct)})
            yield _sse_event("partial", {"plan": _plan_payload(plan)})

        result = _repo.apply_agent_update(
            idea_id,
            version=payload.version,
            mutate_context=lambda context: _apply_feasibility(context, payload, output),
        )
        error_payload = _sse_error_payload(result)
        if error_payload is not None:
            yield _sse_event("error", error_payload)
            return

        assert result.idea is not None
        yield _sse_event(
            "done",
            {
                "idea_id": idea_id,
                "idea_version": result.idea.version,
                "data": output.model_dump(),
            },
        )

    return EventSourceResponse(event_generator())


def _build_prd_context_pack(
    *,
    idea_id: str,
    baseline_id: str,
    context: DecisionContext,
) -> PrdContextPack:
    baseline = _scope_repo.get_baseline(idea_id, baseline_id)
    if baseline is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "SCOPE_BASELINE_NOT_FOUND", "message": "Scope baseline not found"},
        )
    if baseline.status != "frozen":
        raise HTTPException(
            status_code=409,
            detail={"code": "SCOPE_BASELINE_NOT_FROZEN", "message": "Scope baseline is not frozen"},
        )

    latest_path = repo_dag.get_latest_path(idea_id)
    if latest_path is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PRD_CONFIRMED_PATH_REQUIRED",
                "message": "Confirmed path is required before PRD generation",
            },
        )

    selected_plan_id = context.selected_plan_id
    if not selected_plan_id:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PRD_SELECTED_PLAN_REQUIRED",
                "message": "Selected feasibility plan is required before PRD generation",
            },
        )
    if context.feasibility is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PRD_FEASIBILITY_REQUIRED",
                "message": "Feasibility output is required before PRD generation",
            },
        )

    selected_plan = next((plan for plan in context.feasibility.plans if plan.id == selected_plan_id), None)
    if selected_plan is None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PRD_SELECTED_PLAN_NOT_FOUND",
                "message": "Selected plan id is not present in feasibility output",
            },
        )

    parsed_path_json = _parse_path_json(latest_path.path_json)
    path_summary = _resolve_path_summary(context, parsed_path_json)
    leaf_node_id, leaf_node_content = _resolve_leaf_node(context, parsed_path_json)
    mapped_scope = _scope_from_baseline(
        baseline,
        existing_scope=context.scope,
    )
    return PrdContextPack(
        idea_seed=context.idea_seed or "Untitled idea",
        step2_path=PrdStep2Path(
            path_id=latest_path.id,
            path_md=latest_path.path_md,
            path_json=parsed_path_json,
            path_summary=path_summary,
            leaf_node_id=leaf_node_id,
            leaf_node_content=leaf_node_content,
        ),
        step3_feasibility=PrdStep3Feasibility(
            selected_plan=selected_plan,
            alternatives_brief=[
                PrdPlanBrief(
                    id=plan.id,
                    name=plan.name,
                    summary=plan.summary,
                    score_overall=plan.score_overall,
                    recommended_positioning=plan.recommended_positioning,
                )
                for plan in context.feasibility.plans
                if plan.id != selected_plan.id
            ][:2],
        ),
        step4_scope=PrdStep4Scope(
            baseline_meta=PrdBaselineMeta(
                baseline_id=baseline.id,
                version=baseline.version,
                status=baseline.status,
                source_baseline_id=baseline.source_baseline_id,
            ),
            in_scope=mapped_scope.in_scope,
            out_scope=mapped_scope.out_scope,
        ),
    )


def _parse_path_json(raw_path_json: str) -> dict[str, object]:
    try:
        decoded = json.loads(raw_path_json)
        if isinstance(decoded, dict):
            return decoded
    except json.JSONDecodeError:
        return {}
    return {}


def _resolve_path_summary(context: DecisionContext, path_json: dict[str, object]) -> str:
    if context.confirmed_dag_path_summary:
        return context.confirmed_dag_path_summary
    summary = path_json.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()
    return "No confirmed path summary provided."


def _resolve_leaf_node(context: DecisionContext, path_json: dict[str, object]) -> tuple[str, str]:
    node_chain = path_json.get("node_chain")
    if isinstance(node_chain, list) and node_chain:
        last = node_chain[-1]
        if isinstance(last, dict):
            node_id = str(last.get("id", "")).strip()
            content = str(last.get("content", "")).strip()
            if node_id and content:
                return node_id, content

    node_id = (context.confirmed_dag_node_id or "").strip()
    node_content = (context.confirmed_dag_node_content or "").strip()
    if node_id and node_content:
        return node_id, node_content
    raise HTTPException(
        status_code=409,
        detail={
            "code": "PRD_CONFIRMED_NODE_REQUIRED",
            "message": "Confirmed node details are required before PRD generation",
        },
    )


def _scope_from_baseline(
    baseline: ScopeBaselineRecord,
    *,
    existing_scope: ScopeOutput | None,
) -> ScopeOutput:
    in_scope_by_title: dict[str, InScopeItem] = {}
    out_scope_by_title: dict[str, OutScopeItem] = {}
    if existing_scope is not None:
        in_scope_by_title = {_normalize_title(item.title): item for item in existing_scope.in_scope}
        out_scope_by_title = {_normalize_title(item.title): item for item in existing_scope.out_scope}

    in_scope: list[InScopeItem] = []
    out_scope: list[OutScopeItem] = []
    for item in baseline.items:
        normalized = _normalize_title(item.content)
        if item.lane == "in":
            existing = in_scope_by_title.get(normalized)
            in_scope.append(
                InScopeItem(
                    id=item.id,
                    title=item.content,
                    desc=(existing.desc if existing is not None else ""),
                    priority=(existing.priority if existing is not None else "P1"),
                )
            )
            continue

        existing_out = out_scope_by_title.get(normalized)
        out_scope.append(
            OutScopeItem(
                id=item.id,
                title=item.content,
                desc=(existing_out.desc if existing_out is not None else ""),
                reason=(existing_out.reason if existing_out is not None else ""),
            )
        )
    return ScopeOutput(in_scope=in_scope, out_scope=out_scope)


def _normalize_title(value: str) -> str:
    return " ".join(value.split()).strip().lower()


def _context_pack_fingerprint(pack: PrdContextPack) -> str:
    serialized = json.dumps(pack.model_dump(mode="python"), ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _plan_payload(plan: Plan) -> dict[str, object]:
    return plan.model_dump()


def _apply_opportunity(
    context: DecisionContext,
    payload: OpportunityIdeaRequest,
    output: OpportunityOutput,
) -> DecisionContext:
    context.idea_seed = payload.idea_seed
    context.opportunity = output
    context.feasibility = None
    context.selected_plan_id = None
    context.scope = None
    context.scope_frozen = False
    context.prd = None
    context.prd_bundle = None
    context.prd_feedback_latest = None
    return context


def _apply_feasibility(
    context: DecisionContext,
    payload: FeasibilityIdeaRequest,
    output: FeasibilityOutput,
) -> DecisionContext:
    context.idea_seed = payload.idea_seed
    context.confirmed_dag_path_id = payload.confirmed_path_id
    context.confirmed_dag_node_id = payload.confirmed_node_id
    context.confirmed_dag_node_content = payload.confirmed_node_content
    context.confirmed_dag_path_summary = payload.confirmed_path_summary
    context.feasibility = output
    context.selected_plan_id = None
    context.scope = None
    context.scope_frozen = False
    context.prd = None
    context.prd_bundle = None
    context.prd_feedback_latest = None
    return context


def _apply_scope(
    context: DecisionContext,
    payload: ScopeIdeaRequest,
    output: ScopeOutput,
) -> DecisionContext:
    context.idea_seed = payload.idea_seed
    context.confirmed_dag_path_id = payload.confirmed_path_id
    context.confirmed_dag_node_id = payload.confirmed_node_id
    context.confirmed_dag_node_content = payload.confirmed_node_content
    context.confirmed_dag_path_summary = payload.confirmed_path_summary
    context.selected_plan_id = payload.selected_plan_id
    context.feasibility = payload.feasibility
    context.scope = output
    context.prd = None
    context.prd_bundle = None
    context.prd_feedback_latest = None
    return context


def _apply_prd(
    context: DecisionContext,
    pack: PrdContextPack,
    bundle: PrdBundle,
) -> DecisionContext:
    context.idea_seed = pack.idea_seed
    context.confirmed_dag_path_id = pack.step2_path.path_id
    context.confirmed_dag_node_id = pack.step2_path.leaf_node_id
    context.confirmed_dag_node_content = pack.step2_path.leaf_node_content
    context.confirmed_dag_path_summary = pack.step2_path.path_summary
    context.selected_plan_id = pack.step3_feasibility.selected_plan.id
    context.scope = ScopeOutput(
        in_scope=pack.step4_scope.in_scope,
        out_scope=pack.step4_scope.out_scope,
    )
    context.scope_frozen = True
    context.current_scope_baseline_id = pack.step4_scope.baseline_meta.baseline_id
    context.current_scope_baseline_version = pack.step4_scope.baseline_meta.version
    context.prd = bundle.output
    context.prd_bundle = bundle
    context.prd_feedback_latest = None
    return context


def _unwrap_update(result: UpdateIdeaResult) -> int:
    if result.kind == "ok" and result.idea is not None:
        return result.idea.version

    if result.kind == "not_found":
        raise HTTPException(
            status_code=404,
            detail={"code": "IDEA_NOT_FOUND", "message": "Idea not found"},
        )

    if result.kind == "archived":
        raise HTTPException(
            status_code=409,
            detail={"code": "IDEA_ARCHIVED", "message": "Idea is archived"},
        )

    raise HTTPException(
        status_code=409,
        detail={"code": "IDEA_VERSION_CONFLICT", "message": "Idea version conflict"},
    )


def _sse_error_payload(result: UpdateIdeaResult) -> dict[str, object] | None:
    if result.kind == "ok":
        return None

    if result.kind == "not_found":
        return {"code": "IDEA_NOT_FOUND", "message": "Idea not found"}

    if result.kind == "archived":
        return {"code": "IDEA_ARCHIVED", "message": "Idea is archived"}

    return {"code": "IDEA_VERSION_CONFLICT", "message": "Idea version conflict"}
