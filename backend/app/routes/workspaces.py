from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.repo_ideas import IdeaRepository
from app.schemas.ideas import WorkspaceDetail

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
_repo = IdeaRepository()


@router.get("/default", response_model=WorkspaceDetail)
async def get_default_workspace() -> WorkspaceDetail:
    workspace = _repo.get_default_workspace()
    if workspace is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "WORKSPACE_NOT_FOUND", "message": "Default workspace not found"},
        )

    return WorkspaceDetail(
        id=workspace.id,
        name=workspace.name,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )
