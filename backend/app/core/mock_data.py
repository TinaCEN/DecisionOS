from __future__ import annotations

import hashlib

from app.schemas.common import (
    Direction,
    DirectionId,
    PriorityLevel,
    ReasoningBreakdown,
    ScoreBreakdown,
)
from app.schemas.feasibility import FeasibilityInput, FeasibilityOutput, Plan
from app.schemas.idea import OPPORTUNITY_MAX_COUNT, OPPORTUNITY_MIN_COUNT, OpportunityOutput
from app.schemas.prd import (
    PRDBacklog,
    PRDBacklogItem,
    PRDGenerationMeta,
    PRDOutput,
    PRDRequirement,
    PRDSection,
    PrdContextPack,
)
from app.schemas.scope import InScopeItem, OutScopeItem, ScopeInput, ScopeOutput

_DIRECTION_TEMPLATES: list[tuple[str, str, list[str]]] = [
    (
        "Rapid Validation Assistant",
        "Help solo founders validate a product idea in 48 hours.",
        ["unclear demand", "time pressure", "scope drift"],
    ),
    (
        "Decision Compression Workspace",
        "Turn noisy product discussions into one-page decisions.",
        ["too many options", "meeting fatigue", "slow alignment"],
    ),
    (
        "MVP Launch Copilot",
        "Sequence tasks from concept to first public launch.",
        ["execution chaos", "hidden dependencies", "missed deadlines"],
    ),
    (
        "Feature Prioritization Radar",
        "Rank potential features by impact and build effort.",
        ["backlog overload", "low signal", "resource mismatch"],
    ),
    (
        "Experiment Tracker for Teams",
        "Track hypotheses, tests, and outcomes in one flow.",
        ["weak learning loops", "result ambiguity", "context loss"],
    ),
    (
        "Niche Market Discovery Lens",
        "Map underserved user segments and actionable wedges.",
        ["crowded market", "weak positioning", "uncertain niche"],
    ),
]

_PLAN_TEMPLATES: list[tuple[str, str, str]] = [
    (
        "Single-Flow MVP",
        "Build one polished core workflow and defer advanced automation.",
        "Position as the fastest path from idea to first user signal.",
    ),
    (
        "Template-Driven Toolkit",
        "Ship reusable templates first to reduce onboarding friction.",
        "Position as a plug-and-play decision kit for hackathon teams.",
    ),
    (
        "Analytics-First Rollout",
        "Instrument every action early and optimize with usage data.",
        "Position as a measurable decision engine for iterative builders.",
    ),
    (
        "Service + Product Hybrid",
        "Pair lightweight tooling with guided strategy recommendations.",
        "Position as a hands-on copilot for solo founders.",
    ),
    (
        "Integration-Lite Strategy",
        "Export outcomes to existing tools before deep native integrations.",
        "Position as the missing strategic layer above existing stacks.",
    ),
    (
        "Community-Led Launch",
        "Use public build logs and feedback loops to shape priorities.",
        "Position as a transparent builder OS refined with real users.",
    ),
]

_IN_SCOPE_BANK: list[tuple[str, str]] = [
    ("Idea intake with deterministic mock generation", "Capture idea seed and generate repeatable outputs."),
    ("Configurable opportunity canvas", "Generate between one and six direction options on demand."),
    ("Feasibility plan cards with score breakdown", "Compare top plans with clear dimension scores."),
    ("Scope freeze IN/OUT board", "Lock MVP boundaries after plan confirmation."),
    ("POST-based SSE streaming", "Incrementally render partial outputs with progress events."),
    ("Guard rails for missing context", "Prevent jumping to downstream steps without prerequisites."),
]

_OUT_SCOPE_BANK: list[tuple[str, str]] = [
    ("Team workspace and RBAC", "MVP focuses on single-session solo usage."),
    ("Persistent server-side history", "Hackathon demo can rely on client persistence only."),
    ("Third-party integrations", "Avoid Notion/Jira complexity in first release."),
    ("Automated billing and plans", "No monetization workflow required for MVP."),
    ("Multi-language localization", "Initial demo targets one language market."),
    ("Native mobile clients", "Web-first experience is sufficient for demo stage."),
]

_REASONS_TECH = [
    "Architecture remains simple with low operational complexity.",
    "Main risk is integration churn, but fallback mocks reduce exposure.",
    "Implementation is straightforward with existing FastAPI primitives.",
]

_REASONS_MARKET = [
    "Pain point is visible for indie builders under delivery pressure.",
    "Comparable products exist, but speed-to-decision is still under-served.",
    "Positioning is differentiated by deterministic demo reliability.",
]

_REASONS_RISK = [
    "Execution risk is contained by narrow MVP scope and fixed outputs.",
    "Risk remains moderate because frontend streaming logic is concurrency-sensitive.",
    "Most unknowns are UX polish, not core technical feasibility.",
]

_DIRECTION_IDS: tuple[DirectionId, ...] = ("A", "B", "C", "D", "E", "F")
_PRIORITIES: tuple[PriorityLevel, ...] = ("P0", "P1", "P2")


def generate_opportunity_output(idea_seed: str, *, count: int) -> OpportunityOutput:
    if count < OPPORTUNITY_MIN_COUNT or count > OPPORTUNITY_MAX_COUNT:
        raise ValueError(f"count must be between {OPPORTUNITY_MIN_COUNT} and {OPPORTUNITY_MAX_COUNT}")

    base = _seed_int(f"opportunity:{idea_seed}")
    directions: list[Direction] = []

    for index, direction_id in enumerate(_DIRECTION_IDS[:count]):
        template = _DIRECTION_TEMPLATES[(base + index) % len(_DIRECTION_TEMPLATES)]
        title, one_liner, pain_tags = template
        directions.append(
            Direction(
                id=direction_id,
                title=title,
                one_liner=one_liner,
                pain_tags=pain_tags,
            )
        )

    return OpportunityOutput(directions=directions)


def generate_feasibility_output(payload: FeasibilityInput) -> FeasibilityOutput:
    seed = (
        f"feasibility:{payload.idea_seed}:{payload.confirmed_path_id}:"
        f"{payload.confirmed_node_id}:{payload.confirmed_node_content}:{payload.confirmed_path_summary}"
    )
    base = _seed_int(seed)

    plans: list[Plan] = []
    for index in range(3):
        template = _PLAN_TEMPLATES[(base + index) % len(_PLAN_TEMPLATES)]
        name, summary, positioning = template

        technical = _score(seed, index * 3)
        market = _score(seed, index * 3 + 1)
        execution = _score(seed, index * 3 + 2)

        plans.append(
            Plan(
                id=f"plan{index + 1}",
                name=name,
                summary=summary,
                score_overall=round((technical + market + execution) / 3, 1),
                scores=ScoreBreakdown(
                    technical_feasibility=technical,
                    market_viability=market,
                    execution_risk=execution,
                ),
                reasoning=ReasoningBreakdown(
                    technical_feasibility=_REASONS_TECH[(base + index) % len(_REASONS_TECH)],
                    market_viability=_REASONS_MARKET[(base + index) % len(_REASONS_MARKET)],
                    execution_risk=_REASONS_RISK[(base + index) % len(_REASONS_RISK)],
                ),
                recommended_positioning=positioning,
            )
        )

    return FeasibilityOutput(plans=plans)


def generate_scope_output(payload: ScopeInput) -> ScopeOutput:
    seed = (
        f"scope:{payload.idea_seed}:{payload.selected_plan_id}:"
        f"{payload.confirmed_path_id}:{payload.confirmed_node_id}"
    )
    base = _seed_int(seed)

    in_scope: list[InScopeItem] = []
    out_scope: list[OutScopeItem] = []

    for index in range(3):
        title, desc = _IN_SCOPE_BANK[(base + index) % len(_IN_SCOPE_BANK)]
        priority = _PRIORITIES[index]
        in_scope.append(
            InScopeItem(
                id=f"f{index + 1}",
                title=title,
                desc=desc,
                priority=priority,
            )
        )

    for index in range(3):
        title, reason = _OUT_SCOPE_BANK[(base + index) % len(_OUT_SCOPE_BANK)]
        out_scope.append(
            OutScopeItem(
                id=f"f{index + 9}",
                title=title,
                desc="Deferred after MVP validation milestone.",
                reason=reason,
            )
        )

    return ScopeOutput(in_scope=in_scope, out_scope=out_scope)


def generate_prd_output(context_pack: PrdContextPack) -> PRDOutput:
    seed = (
        f"prd:{context_pack.idea_seed}:{context_pack.step2_path.path_id}:"
        f"{context_pack.step3_feasibility.selected_plan.id}:{context_pack.step4_scope.baseline_meta.baseline_id}"
    )
    base = _seed_int(seed)
    in_scope_titles = [item.title for item in context_pack.step4_scope.in_scope]

    sections = [
        PRDSection(
            id="problem-statement",
            title="Problem Statement",
            content=(
                f"Teams exploring {context_pack.idea_seed!r} need one delivery-ready plan tied to "
                "a confirmed decision path and frozen scope."
            ),
        ),
        PRDSection(
            id="target-users",
            title="Target Users",
            content="Solo builders and small product squads who need deterministic planning outputs.",
        ),
        PRDSection(
            id="product-goals",
            title="Product Goals",
            content=(
                "Generate a requirement-driven PRD and executable backlog in one pass with explicit "
                "traceability to decision evidence."
            ),
        ),
        PRDSection(
            id="core-workflow",
            title="Core Workflow",
            content=(
                "Confirmed path -> selected feasibility plan -> frozen baseline -> PRD+Backlog generation."
            ),
        ),
        PRDSection(
            id="mvp-scope",
            title="MVP Scope",
            content="\n".join(f"- {title}" for title in in_scope_titles) if in_scope_titles else "- N/A",
        ),
        PRDSection(
            id="risks-and-mitigations",
            title="Risks and Mitigations",
            content=(
                "Main risks are scope drift and weak requirement quality. Mitigate with strict output "
                "schema and baseline-driven generation."
            ),
        ),
    ]

    requirements: list[PRDRequirement] = []
    scoped_count = max(6, min(12, len(context_pack.step4_scope.in_scope) * 2 or 6))
    for index in range(scoped_count):
        if context_pack.step4_scope.in_scope:
            scope_item = context_pack.step4_scope.in_scope[
                index % len(context_pack.step4_scope.in_scope)
            ]
            scope_title = scope_item.title
        else:
            scope_title = f"Scoped capability {index + 1}"
        req_id = f"REQ-{index + 1}"
        requirements.append(
            PRDRequirement(
                id=req_id,
                title=f"{scope_title} capability {index + 1}",
                description=(
                    f"System must support {scope_title.lower()} while preserving the confirmed "
                    "decision constraints."
                ),
                rationale=(
                    "Derived from confirmed path narrative, selected feasibility strategy, and frozen baseline."
                ),
                acceptance_criteria=[
                    "Behavior is testable with deterministic inputs.",
                    "Output is traceable to a frozen baseline item.",
                ],
                source_refs=["step2", "step3", "step4"],
            )
        )

    backlog_items: list[PRDBacklogItem] = []
    backlog_count = max(8, min(15, len(requirements) + 2))
    for index in range(backlog_count):
        req = requirements[index % len(requirements)]
        backlog_items.append(
            PRDBacklogItem(
                id=f"BL-{index + 1}",
                title=f"Implement {req.title}",
                requirement_id=req.id,
                priority=_PRIORITIES[index % len(_PRIORITIES)],
                type=("epic" if index % 3 == 0 else "story" if index % 3 == 1 else "task"),
                summary=(
                    f"Deliver requirement {req.id} for baseline "
                    f"{context_pack.step4_scope.baseline_meta.baseline_id}."
                ),
                acceptance_criteria=[
                    "Definition of done is explicit and reviewable.",
                    "Linked requirement ID is present in metadata.",
                ],
                source_refs=["step4", "step3"] if index % 2 == 0 else ["step2", "step4"],
                depends_on=[f"BL-{index}"] if index > 0 and index % 4 == 0 else [],
            )
        )

    markdown_lines = [
        "# Product Requirements Document",
        "",
        f"Baseline: {context_pack.step4_scope.baseline_meta.baseline_id}",
        "",
    ]
    for section in sections:
        markdown_lines.append(f"## {section.title}")
        markdown_lines.append(section.content)
        markdown_lines.append("")
    markdown_lines.append("## Requirements")
    for requirement in requirements:
        markdown_lines.append(f"- {requirement.id}: {requirement.title}")

    generation_meta = PRDGenerationMeta(
        provider_id="mock-provider",
        model="mock-prd-v2",
        confirmed_path_id=context_pack.step2_path.path_id,
        selected_plan_id=context_pack.step3_feasibility.selected_plan.id,
        baseline_id=context_pack.step4_scope.baseline_meta.baseline_id,
    )
    return PRDOutput(
        markdown="\n".join(markdown_lines),
        sections=sections,
        requirements=requirements,
        backlog=PRDBacklog(items=backlog_items),
        generation_meta=generation_meta,
    )


MOCK_EXPAND_NODES: list[dict[str, str]] = [
    {"content": "Mock child idea A — narrow focus on power users", "edge_label": "缩小用户群体"},
    {"content": "Mock child idea B — extend to enterprise workflow", "edge_label": "缩小用户群体"},
]

MOCK_PATH_SUMMARY = (
    "This idea evolved from a broad concept to a focused solution "
    "for a specific user segment, validating core assumptions along the way."
)


def _seed_int(seed: str) -> int:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=False)


def _score(seed: str, offset: int) -> float:
    raw = _seed_int(f"{seed}:{offset}") % 331
    return round(6.7 + raw / 100, 1)
