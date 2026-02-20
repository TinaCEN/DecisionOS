from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

ProviderKind = Literal["generic_json", "openai_compatible"]
TaskName = Literal["opportunity", "feasibility", "scope", "prd"]


class AIProviderConfig(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: ProviderKind
    base_url: str = Field(min_length=1)
    api_key: str | None = None
    model: str | None = None
    enabled: bool = True
    timeout_seconds: float = Field(default=20.0, ge=1.0, le=120.0)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)


class AIRoutingConfig(BaseModel):
    opportunity: list[str] = Field(default_factory=list)
    feasibility: list[str] = Field(default_factory=list)
    scope: list[str] = Field(default_factory=list)
    prd: list[str] = Field(default_factory=list)


class AISettingsPayload(BaseModel):
    providers: list[AIProviderConfig] = Field(default_factory=list)
    routing: AIRoutingConfig = Field(default_factory=AIRoutingConfig)

    @model_validator(mode="after")
    def _validate_provider_ids(self) -> AISettingsPayload:
        provider_ids = [provider.id for provider in self.providers]
        if len(provider_ids) != len(set(provider_ids)):
            raise ValueError("Provider IDs must be unique")

        allowed = set(provider_ids)
        for task_name in ("opportunity", "feasibility", "scope", "prd"):
            routed_ids = getattr(self.routing, task_name)
            unknown = [provider_id for provider_id in routed_ids if provider_id not in allowed]
            if unknown:
                raise ValueError(f"Unknown provider IDs in routing.{task_name}: {', '.join(unknown)}")
        return self


class AISettingsDetail(AISettingsPayload):
    id: str
    created_at: str
    updated_at: str


class TestAIProviderRequest(BaseModel):
    provider: AIProviderConfig


class TestAIProviderResponse(BaseModel):
    ok: bool
    latency_ms: int
    message: str
