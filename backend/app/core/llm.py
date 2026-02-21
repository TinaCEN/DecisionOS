from __future__ import annotations

from collections.abc import Callable
import json
import logging
from typing import TypeVar

from app.core import ai_gateway
from app.core import mock_data
from app.core import prompts
from app.core.settings import get_settings
from app.schemas.feasibility import FeasibilityInput, FeasibilityOutput
from app.schemas.idea import OpportunityInput, OpportunityOutput
from app.schemas.prd import PRDOutput, PrdContextPack
from app.schemas.scope import ScopeInput, ScopeOutput

SchemaT = TypeVar("SchemaT")
logger = logging.getLogger(__name__)


class PRDGenerationError(RuntimeError):
    pass


def generate_json(
    *,
    mock_factory: Callable[[], SchemaT],
    model_factory: Callable[[], SchemaT] | None = None,
) -> SchemaT:
    settings = get_settings()
    if settings.llm_mode != "mock" and model_factory is not None:
        try:
            return model_factory()
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI provider call failed, fallback to mock output: %s", exc)
    return mock_factory()


def generate_opportunity(payload: OpportunityInput) -> OpportunityOutput:
    return generate_json(
        mock_factory=lambda: mock_data.generate_opportunity_output(payload.idea_seed, count=payload.count),
        model_factory=lambda: ai_gateway.generate_structured(
            task="opportunity",
            user_prompt=prompts.build_opportunity_prompt(idea_seed=payload.idea_seed, count=payload.count),
            schema_model=OpportunityOutput,
        ),
    )


def generate_feasibility(payload: FeasibilityInput) -> FeasibilityOutput:
    return generate_json(
        mock_factory=lambda: mock_data.generate_feasibility_output(payload),
        model_factory=lambda: ai_gateway.generate_structured(
            task="feasibility",
            user_prompt=prompts.build_feasibility_prompt(
                idea_seed=payload.idea_seed,
                confirmed_path_id=payload.confirmed_path_id,
                confirmed_node_id=payload.confirmed_node_id,
                confirmed_node_content=payload.confirmed_node_content,
                confirmed_path_summary=payload.confirmed_path_summary,
            ),
            schema_model=FeasibilityOutput,
        ),
    )


def generate_scope(payload: ScopeInput) -> ScopeOutput:
    return generate_json(
        mock_factory=lambda: mock_data.generate_scope_output(payload),
        model_factory=lambda: ai_gateway.generate_structured(
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
        ),
    )


def generate_prd_strict(context_pack: PrdContextPack) -> PRDOutput:
    settings = get_settings()
    if settings.llm_mode == "mock":
        return mock_data.generate_prd_output(context_pack)

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
    return generate_json(
        mock_factory=lambda: mock_data.MOCK_EXPAND_NODES,
        model_factory=lambda: _parse_nodes_from_text(
            ai_gateway.generate_text(
                task="opportunity",
                user_prompt=prompts.expand_node_prompt(
                    content, pattern_label, pattern_description, chain_summary
                ),
            )
        ),
    )


def generate_expand_node_user(
    content: str,
    user_direction: str,
    chain_summary: str,
) -> list[dict[str, str]]:
    """Return list of {content, edge_label} dicts for user-guided expansion."""
    return generate_json(
        mock_factory=lambda: mock_data.MOCK_EXPAND_NODES[:1],
        model_factory=lambda: _parse_nodes_from_text(
            ai_gateway.generate_text(
                task="opportunity",
                user_prompt=prompts.expand_node_user_prompt(
                    content, user_direction, chain_summary
                ),
            )
        ),
    )


def generate_path_summary(node_chain_text: str) -> str:
    """Return a plain-text summary of a confirmed path."""
    settings = get_settings()
    if settings.llm_mode == "mock":
        return mock_data.MOCK_PATH_SUMMARY
    try:
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
    except Exception as exc:  # noqa: BLE001
        logger.warning("Path summary AI call failed, fallback to mock: %s", exc)
        return mock_data.MOCK_PATH_SUMMARY
