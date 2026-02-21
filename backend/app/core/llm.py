from __future__ import annotations

import json
import logging
from typing import TypeVar

from app.core import ai_gateway
from app.core import prompts
from app.schemas.feasibility import FeasibilityInput, FeasibilityOutput
from app.schemas.idea import OpportunityInput, OpportunityOutput
from app.schemas.prd import PRDOutput, PrdContextPack
from app.schemas.scope import ScopeInput, ScopeOutput

SchemaT = TypeVar("SchemaT")
logger = logging.getLogger(__name__)


class PRDGenerationError(RuntimeError):
    pass


def generate_opportunity(payload: OpportunityInput) -> OpportunityOutput:
    return ai_gateway.generate_structured(
        task="opportunity",
        user_prompt=prompts.build_opportunity_prompt(idea_seed=payload.idea_seed, count=payload.count),
        schema_model=OpportunityOutput,
    )


def generate_feasibility(payload: FeasibilityInput) -> FeasibilityOutput:
    return ai_gateway.generate_structured(
        task="feasibility",
        user_prompt=prompts.build_feasibility_prompt(
            idea_seed=payload.idea_seed,
            confirmed_path_id=payload.confirmed_path_id,
            confirmed_node_id=payload.confirmed_node_id,
            confirmed_node_content=payload.confirmed_node_content,
            confirmed_path_summary=payload.confirmed_path_summary,
        ),
        schema_model=FeasibilityOutput,
    )


def generate_single_plan(payload: FeasibilityInput, plan_index: int) -> Plan:
    """Generate exactly one feasibility Plan concurrently with other plan calls."""
    from app.schemas.feasibility import Plan  # local import to avoid circular at module level

    return ai_gateway.generate_structured(
        task="feasibility",
        user_prompt=prompts.build_single_plan_prompt(
            idea_seed=payload.idea_seed,
            confirmed_node_content=payload.confirmed_node_content,
            confirmed_path_summary=payload.confirmed_path_summary,
            plan_index=plan_index,
        ),
        schema_model=Plan,
    )


def generate_scope(payload: ScopeInput) -> ScopeOutput:
    return ai_gateway.generate_structured(
        task="scope",
        user_prompt=prompts.build_scope_prompt(
            idea_seed=payload.idea_seed,
            confirmed_path_id=payload.confirmed_path_id,
            confirmed_node_id=payload.confirmed_node_id,
            confirmed_node_content=payload.confirmed_node_content,
            confirmed_path_summary=payload.confirmed_path_summary,
            selected_plan_id=payload.selected_plan_id,
            feasibility_payload=payload.feasibility.model_dump(mode="python"),
        ),
        schema_model=ScopeOutput,
    )


def generate_prd_strict(context_pack: PrdContextPack) -> PRDOutput:
    try:
        return ai_gateway.generate_structured(
            task="prd",
            user_prompt=prompts.build_prd_prompt(
                context_pack=context_pack.model_dump(mode="python"),
            ),
            schema_model=PRDOutput,
        )
    except Exception as exc:
        raise PRDGenerationError("Failed to generate PRD output from provider") from exc


def _parse_nodes_from_text(text: str) -> list[dict[str, str]]:
    """Parse LLM text response into list of {content, edge_label} dicts."""
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    parsed = json.loads(text)
    if isinstance(parsed, list):
        return [
            {"content": str(n.get("content", "")), "edge_label": str(n.get("edge_label", ""))}
            for n in parsed if isinstance(n, dict)
        ]
    if isinstance(parsed, dict) and "nodes" in parsed:
        nodes = parsed["nodes"]
        if isinstance(nodes, list):
            return [
                {"content": str(n.get("content", "")), "edge_label": str(n.get("edge_label", ""))}
                for n in nodes if isinstance(n, dict)
            ]
    raise ValueError(f"Unexpected nodes response shape: {text[:200]}")


def generate_expand_nodes(
    content: str,
    pattern_label: str,
    pattern_description: str,
    chain_summary: str,
) -> list[dict[str, str]]:
    """Return list of {content, edge_label} dicts for AI node expansion."""
    return _parse_nodes_from_text(
        ai_gateway.generate_text(
            task="opportunity",
            user_prompt=prompts.expand_node_prompt(
                content, pattern_label, pattern_description, chain_summary
            ),
        )
    )


def generate_expand_node_user(
    content: str,
    user_direction: str,
    chain_summary: str,
) -> list[dict[str, str]]:
    """Return list of {content, edge_label} dicts for user-guided expansion."""
    return _parse_nodes_from_text(
        ai_gateway.generate_text(
            task="opportunity",
            user_prompt=prompts.expand_node_user_prompt(
                content, user_direction, chain_summary
            ),
        )
    )


def generate_path_summary(node_chain_text: str) -> str:
    """Return a plain-text summary of a confirmed path."""
    raw = ai_gateway.generate_text(
        task="opportunity",
        user_prompt=prompts.summarize_path_prompt(node_chain_text),
    ).strip()
    # Model may return {"summary": "..."} or plain text
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and "summary" in parsed:
            return str(parsed["summary"])
    except json.JSONDecodeError:
        pass
    return raw
