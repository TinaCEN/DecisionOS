from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AuthLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=512)


class AuthUserOut(BaseModel):
    id: str
    username: str
    role: Literal["admin", "user"]


class AuthLoginResponse(BaseModel):
    access_token: str = Field(min_length=1)
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(ge=1)
    user: AuthUserOut
