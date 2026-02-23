from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/agents", tags=["legacy-agents"])


def _raise_legacy_route_gone() -> None:
    raise HTTPException(
        status_code=410,
        detail={
            "code": "LEGACY_AGENTS_ROUTE_GONE",
            "message": "Legacy /agents/* routes are removed. Use /ideas/{idea_id}/agents/* instead.",
        },
    )


@router.api_route(
    "",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def legacy_agents_root() -> None:
    _raise_legacy_route_gone()


@router.api_route(
    "/{legacy_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def legacy_agents_catch_all(legacy_path: str) -> None:
    del legacy_path
    _raise_legacy_route_gone()
