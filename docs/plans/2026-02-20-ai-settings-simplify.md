# AI Settings Simplify Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove per-task routing config, enforce exactly one enabled provider at a time, and add structured backend logging throughout the AI call path.

**Architecture:** The `AISettingsPayload` schema drops the `routing` field entirely; `ai_gateway.py` picks the single enabled provider instead of consulting a routing table. The frontend `AISettingsPage` removes the Task Routing section and implements radio-button semantics for the enabled toggle. Backend logging is added at request/response boundaries in `ai_gateway.py` and `llm.py`.

**Tech Stack:** FastAPI, Pydantic v2, SQLite, Next.js 14, React, Zod, Python `logging` stdlib

---

## Context: Key Files

| File                                              | Role                                     |
| ------------------------------------------------- | ---------------------------------------- |
| `backend/app/schemas/ai_settings.py`              | Pydantic schemas for providers + routing |
| `backend/app/db/repo_ai.py`                       | SQLite persistence for ai_settings       |
| `backend/app/routes/ai_settings.py`               | FastAPI routes: GET/PATCH /settings/ai   |
| `backend/app/core/ai_gateway.py`                  | Provider invocation logic                |
| `backend/app/core/llm.py`                         | Task-level LLM helpers                   |
| `backend/tests/test_ai_settings_api.py`           | API-level tests                          |
| `frontend/lib/schemas.ts`                         | Zod schemas + TypeScript types           |
| `frontend/components/settings/AISettingsPage.tsx` | Settings UI                              |

## How to Run Tests

```bash
# Backend (run from backend/ dir)
uv run python -m pytest tests/ -q

# Frontend type check (run from frontend/ dir)
npx tsc --noEmit
```

---

### Task 1: Strip routing from backend schema + validator

**Files:**

- Modify: `backend/app/schemas/ai_settings.py`

**Step 1: Update `AISettingsPayload` — remove `AIRoutingConfig` and add single-enabled validator**

Replace the entire file content:

```python
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


class AISettingsPayload(BaseModel):
    providers: list[AIProviderConfig] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_providers(self) -> AISettingsPayload:
        ids = [p.id for p in self.providers]
        if len(ids) != len(set(ids)):
            raise ValueError("Provider IDs must be unique")
        enabled_count = sum(1 for p in self.providers if p.enabled)
        if enabled_count > 1:
            raise ValueError("At most one provider may be enabled at a time")
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
```

**Step 2: Verify tests still import correctly**

```bash
cd backend
uv run python -c "from app.schemas.ai_settings import AISettingsPayload; print('OK')"
```

Expected: `OK`

---

### Task 2: Update `repo_ai.py` — remove routing from default payload

**Files:**

- Modify: `backend/app/db/repo_ai.py`

**Step 1: Update `default_ai_settings_payload`**

Replace:

```python
def default_ai_settings_payload() -> dict[str, object]:
    return {
        "providers": [],
        "routing": {
            "opportunity": [],
            "feasibility": [],
            "scope": [],
            "prd": [],
        },
    }
```

With:

```python
def default_ai_settings_payload() -> dict[str, object]:
    return {"providers": []}
```

**Step 2: Verify import**

```bash
uv run python -c "from app.db.repo_ai import AISettingsRepository; print('OK')"
```

Expected: `OK`

---

### Task 3: Update `ai_gateway.py` — remove routing lookup, add logging

**Files:**

- Modify: `backend/app/core/ai_gateway.py`

**Step 1: Replace the routing lookup in `generate_structured` and `generate_text` with single-enabled logic, and add logging throughout**

Replace the full file content:

```python
from __future__ import annotations

import json
import logging
import time
from typing import TypeVar, cast
from urllib import request

from pydantic import BaseModel

from app.core.prompts import SYSTEM_PROMPT
from app.db.repo_ai import AISettingsRepository
from app.schemas.ai_settings import AIProviderConfig, TaskName

SchemaT = TypeVar("SchemaT", bound=BaseModel)

_settings_repo = AISettingsRepository()
logger = logging.getLogger(__name__)


def _get_active_provider() -> AIProviderConfig:
    """Return the single enabled provider, or raise if none configured."""
    settings = _settings_repo.get_settings().config
    enabled = [p for p in settings.providers if p.enabled]
    if not enabled:
        raise RuntimeError("No enabled AI provider configured. Visit Settings to enable one.")
    return enabled[0]


def generate_structured(
    *,
    task: TaskName,
    user_prompt: str,
    schema_model: type[SchemaT],
) -> SchemaT:
    provider = _get_active_provider()
    logger.info("generate_structured task=%s provider=%s model=%s", task, provider.id, provider.model)
    response_schema = schema_model.model_json_schema()
    try:
        raw = _invoke_provider(
            provider=provider,
            task=task,
            user_prompt=user_prompt,
            response_schema=response_schema,
        )
        result = schema_model.model_validate(raw)
        logger.info("generate_structured task=%s provider=%s SUCCESS", task, provider.id)
        return result
    except Exception as exc:
        logger.error("generate_structured task=%s provider=%s FAILED: %s", task, provider.id, exc)
        raise


def generate_text(*, task: TaskName, user_prompt: str) -> str:
    """Call provider and return raw text content (no schema enforcement)."""
    provider = _get_active_provider()
    logger.info("generate_text task=%s provider=%s model=%s", task, provider.id, provider.model)
    try:
        result = _invoke_provider_text(provider=provider, user_prompt=user_prompt)
        logger.info("generate_text task=%s provider=%s SUCCESS len=%d", task, provider.id, len(result))
        return result
    except Exception as exc:
        logger.error("generate_text task=%s provider=%s FAILED: %s", task, provider.id, exc)
        raise


def _invoke_provider_text(*, provider: AIProviderConfig, user_prompt: str) -> str:
    """Invoke provider and return plain text response content."""
    endpoint = provider.base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    body: dict[str, object] = {
        "model": provider.model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": provider.temperature,
    }
    logger.debug("_invoke_provider_text url=%s model=%s", endpoint, body["model"])
    decoded = _post_json(
        url=endpoint,
        body=body,
        timeout_seconds=provider.timeout_seconds,
        api_key=provider.api_key,
    )
    if not isinstance(decoded, dict):
        raise RuntimeError("Provider response is not an object")
    choices = decoded.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Provider response missing choices")
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, list):
        content = "\n".join(
            item["text"] for item in content if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(content)


def test_provider_connection(provider: AIProviderConfig) -> tuple[bool, int, str]:
    started = time.perf_counter()
    logger.info("test_provider_connection provider=%s kind=%s", provider.id, provider.kind)
    try:
        if provider.kind == "generic_json":
            _probe_generic_json(provider)
        elif provider.kind == "openai_compatible":
            _probe_openai_compatible(provider)
        else:
            raise RuntimeError(f"Unsupported provider kind: {provider.kind}")
    except Exception as exc:  # noqa: BLE001
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.warning("test_provider_connection provider=%s FAILED %dms: %s", provider.id, elapsed_ms, exc)
        return False, elapsed_ms, str(exc)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info("test_provider_connection provider=%s OK %dms", provider.id, elapsed_ms)
    return True, elapsed_ms, "Connection successful"


def _invoke_provider(
    *,
    provider: AIProviderConfig,
    task: TaskName,
    user_prompt: str,
    response_schema: dict[str, object],
) -> dict[str, object]:
    if provider.kind == "generic_json":
        return _call_generic_json_provider(
            provider=provider,
            task=task,
            user_prompt=user_prompt,
            response_schema=response_schema,
        )

    if provider.kind == "openai_compatible":
        return _call_openai_compatible_provider(
            provider=provider,
            user_prompt=user_prompt,
            response_schema=response_schema,
        )

    raise RuntimeError(f"Unsupported provider kind: {provider.kind}")


def _probe_generic_json(provider: AIProviderConfig) -> None:
    schema = {
        "type": "object",
        "properties": {"ok": {"type": "boolean"}},
        "required": ["ok"],
        "additionalProperties": True,
    }
    _call_generic_json_provider(
        provider=provider,
        task="opportunity",
        user_prompt="Return JSON with {'ok': true}.",
        response_schema=schema,
    )


def _probe_openai_compatible(provider: AIProviderConfig) -> None:
    endpoint = provider.base_url.rstrip("/")
    if endpoint.endswith("/chat/completions"):
        endpoint = endpoint[: -len("/chat/completions")]
    if not endpoint.endswith("/v1"):
        endpoint = f"{endpoint}/v1"
    models_url = f"{endpoint}/models"

    headers: dict[str, str] = {}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"

    logger.debug("_probe_openai_compatible url=%s", models_url)
    req = request.Request(models_url, headers=headers, method="GET")
    with request.urlopen(req, timeout=provider.timeout_seconds) as response:
        raw = response.read().decode("utf-8")
    decoded = json.loads(raw)
    if not isinstance(decoded, dict):
        raise RuntimeError("Unexpected /models response shape")


def _call_generic_json_provider(
    *,
    provider: AIProviderConfig,
    task: TaskName,
    user_prompt: str,
    response_schema: dict[str, object],
) -> dict[str, object]:
    body: dict[str, object] = {
        "system_prompt": SYSTEM_PROMPT,
        "user_prompt": user_prompt,
        "response_schema": response_schema,
        "model": provider.model,
        "temperature": provider.temperature,
        "task": task,
    }
    logger.debug("_call_generic_json_provider url=%s task=%s model=%s", provider.base_url, task, provider.model)
    decoded = _post_json(
        url=provider.base_url,
        body=body,
        timeout_seconds=provider.timeout_seconds,
        api_key=provider.api_key,
    )
    if isinstance(decoded, dict) and "data" in decoded and isinstance(decoded["data"], dict):
        return cast(dict[str, object], decoded["data"])
    return cast(dict[str, object], decoded)


def _call_openai_compatible_provider(
    *,
    provider: AIProviderConfig,
    user_prompt: str,
    response_schema: dict[str, object],
) -> dict[str, object]:
    endpoint = provider.base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint = f"{endpoint}/chat/completions"

    body: dict[str, object] = {
        "model": provider.model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": provider.temperature,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "decisionos_response",
                "schema": response_schema,
            },
        },
    }
    logger.debug("_call_openai_compatible_provider url=%s model=%s", endpoint, body["model"])
    decoded = _post_json(
        url=endpoint,
        body=body,
        timeout_seconds=provider.timeout_seconds,
        api_key=provider.api_key,
    )

    if not isinstance(decoded, dict):
        raise RuntimeError("Provider response is not an object")

    choices = decoded.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Provider response missing choices")

    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("Provider response has invalid first choice")

    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("Provider response missing message object")

    content = message.get("content")
    if isinstance(content, dict):
        return cast(dict[str, object], content)
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"])
        content = "\n".join(text_parts)

    if not isinstance(content, str):
        raise RuntimeError("Provider response content is not JSON text")

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise RuntimeError("Provider response content is not a JSON object")
    return cast(dict[str, object], parsed)


def _post_json(
    *,
    url: str,
    body: dict[str, object],
    timeout_seconds: float,
    api_key: str | None,
) -> object:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with request.urlopen(req, timeout=timeout_seconds) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)
```

**Step 2: Verify import**

```bash
uv run python -c "from app.core.ai_gateway import generate_structured; print('OK')"
```

Expected: `OK`

---

### Task 4: Add logging to `llm.py`

**Files:**

- Modify: `backend/app/core/llm.py`

**Step 1: Add logger and log mock fallback**

After the existing imports block, add:

```python
logger = logging.getLogger(__name__)
```

Ensure `import logging` is present at the top.

Update `generate_json` to log when mock fallback fires:

```python
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
    else:
        if settings.llm_mode == "mock":
            logger.debug("LLM_MODE=mock, using mock factory")
    return mock_factory()
```

Add a log line in `generate_path_summary` at the start:

```python
def generate_path_summary(node_chain_text: str) -> str:
    """Return a plain-text summary of a confirmed path."""
    logger.info("generate_path_summary chain_len=%d", len(node_chain_text))
    settings = get_settings()
    ...
```

**Step 2: Verify import**

```bash
uv run python -c "from app.core.llm import generate_opportunity; print('OK')"
```

Expected: `OK`

---

### Task 5: Update backend tests

**Files:**

- Modify: `backend/tests/test_ai_settings_api.py`

**Step 1: Rewrite test file**

Replace the full file:

```python
from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest

from tests.test_api_ideas_and_agents import _AsgiTestClient


class AISettingsApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmpdir.name, "decisionos-ai-settings-test.db")
        os.environ["DECISIONOS_DB_PATH"] = self.db_path

        from app.core.settings import get_settings
        from app.main import create_app

        get_settings.cache_clear()
        self.client = _AsgiTestClient(create_app())

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def test_get_default_ai_settings(self) -> None:
        status, payload = self.client.request_json("GET", "/settings/ai")
        self.assertEqual(status, 200)
        assert payload is not None
        self.assertEqual(payload["id"], "default")
        self.assertEqual(payload["providers"], [])
        # routing field must no longer exist
        self.assertNotIn("routing", payload)

    def test_patch_single_enabled_provider_round_trip(self) -> None:
        patch_status, patch_payload = self.client.request_json(
            "PATCH",
            "/settings/ai",
            {
                "providers": [
                    {
                        "id": "openai_main",
                        "name": "OpenAI Main",
                        "kind": "openai_compatible",
                        "base_url": "https://api.openai.com/v1",
                        "api_key": "sk-local-test",
                        "model": "gpt-4o-mini",
                        "enabled": True,
                        "timeout_seconds": 20,
                        "temperature": 0.2,
                    },
                ]
            },
        )
        self.assertEqual(patch_status, 200)
        assert patch_payload is not None
        self.assertEqual(len(patch_payload["providers"]), 1)
        self.assertTrue(patch_payload["providers"][0]["enabled"])

        # GET must return the same
        get_status, get_payload = self.client.request_json("GET", "/settings/ai")
        self.assertEqual(get_status, 200)
        assert get_payload is not None
        self.assertEqual(get_payload["providers"][0]["api_key"], "sk-local-test")

        # api_key must be encrypted on disk
        with sqlite3.connect(self.db_path) as connection:
            row = connection.execute(
                "SELECT config_json FROM ai_settings WHERE id = ?",
                ("default",),
            ).fetchone()
            assert row is not None
            raw_config = str(row[0])
            self.assertNotIn("sk-local-test", raw_config)
            self.assertIn("enc:v1:", raw_config)

    def test_patch_two_enabled_providers_returns_422(self) -> None:
        status, payload = self.client.request_json(
            "PATCH",
            "/settings/ai",
            {
                "providers": [
                    {
                        "id": "provider_a",
                        "name": "Provider A",
                        "kind": "openai_compatible",
                        "base_url": "https://api.openai.com/v1",
                        "enabled": True,
                        "timeout_seconds": 20,
                        "temperature": 0.2,
                    },
                    {
                        "id": "provider_b",
                        "name": "Provider B",
                        "kind": "generic_json",
                        "base_url": "http://127.0.0.1:8080/generate",
                        "enabled": True,
                        "timeout_seconds": 20,
                        "temperature": 0.2,
                    },
                ]
            },
        )
        self.assertEqual(status, 422)

    def test_patch_two_providers_one_disabled_is_ok(self) -> None:
        status, payload = self.client.request_json(
            "PATCH",
            "/settings/ai",
            {
                "providers": [
                    {
                        "id": "provider_a",
                        "name": "Provider A",
                        "kind": "openai_compatible",
                        "base_url": "https://api.openai.com/v1",
                        "enabled": True,
                        "timeout_seconds": 20,
                        "temperature": 0.2,
                    },
                    {
                        "id": "provider_b",
                        "name": "Provider B",
                        "kind": "generic_json",
                        "base_url": "http://127.0.0.1:8080/generate",
                        "enabled": False,
                        "timeout_seconds": 20,
                        "temperature": 0.2,
                    },
                ]
            },
        )
        self.assertEqual(status, 200)

    def test_test_provider_endpoint_returns_failure_for_unreachable_provider(self) -> None:
        status, payload = self.client.request_json(
            "POST",
            "/settings/ai/test",
            {
                "provider": {
                    "id": "unreachable_local",
                    "name": "Unreachable Local",
                    "kind": "generic_json",
                    "base_url": "http://127.0.0.1:65533/generate",
                    "enabled": True,
                    "timeout_seconds": 1,
                    "temperature": 0.2,
                }
            },
        )
        self.assertEqual(status, 200)
        assert payload is not None
        self.assertEqual(payload["ok"], False)
        self.assertGreaterEqual(payload["latency_ms"], 0)


if __name__ == "__main__":
    unittest.main()
```

**Step 2: Run tests**

```bash
cd backend
uv run python -m pytest tests/test_ai_settings_api.py -v
```

Expected: 5 tests pass.

**Step 3: Run full suite**

```bash
uv run python -m pytest tests/ -q
```

Expected: 37+ tests pass, 0 failures.

**Step 4: Commit backend changes**

```bash
git add backend/app/schemas/ai_settings.py \
        backend/app/db/repo_ai.py \
        backend/app/core/ai_gateway.py \
        backend/app/core/llm.py \
        backend/tests/test_ai_settings_api.py
git commit -m "refactor(ai-settings): remove routing, enforce single-enabled provider, add logging"
```

---

### Task 6: Update frontend Zod schemas — remove routing

**Files:**

- Modify: `frontend/lib/schemas.ts`

**Step 1: Remove `aiRoutingConfigSchema`, `AIRoutingConfig`, and routing fields from `patchAiSettingsRequestSchema` and `aiSettingsSchema`**

Remove these blocks entirely:

```typescript
// DELETE THIS ENTIRE BLOCK:
export const aiRoutingConfigSchema = z.object({
  opportunity: z.array(z.string().min(1)).default([]),
  feasibility: z.array(z.string().min(1)).default([]),
  scope: z.array(z.string().min(1)).default([]),
  prd: z.array(z.string().min(1)).default([]),
})
```

Update `aiSettingsSchema` — remove `routing` field:

```typescript
export const aiSettingsSchema = z.object({
  id: z.string().min(1),
  providers: z.array(aiProviderConfigSchema),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})
```

Update `patchAiSettingsRequestSchema` — remove `routing` field:

```typescript
export const patchAiSettingsRequestSchema = z.object({
  providers: z.array(aiProviderConfigSchema),
})
```

Remove the exported types:

```typescript
// DELETE:
export type AIRoutingConfig = z.infer<typeof aiRoutingConfigSchema>
// DELETE from PatchAISettingsRequest usage
```

Update `PatchAISettingsRequest` type export to remain consistent.

**Step 2: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 7: Update frontend `AISettingsPage.tsx` — remove routing UI, add single-enabled toggle

**Files:**

- Modify: `frontend/components/settings/AISettingsPage.tsx`

**Step 1: Replace full file**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getAiSettings, patchAiSettings, testAiProvider } from '../../lib/api'
import type { AIProviderConfig, AIProviderKind } from '../../lib/schemas'

const DEFAULT_PROVIDER: AIProviderConfig = {
  id: '',
  name: '',
  kind: 'generic_json',
  base_url: '',
  api_key: '',
  model: '',
  enabled: false,
  timeout_seconds: 20,
  temperature: 0.2,
}

export function AISettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, string>>({})
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const run = async () => {
      try {
        const settings = await getAiSettings()
        setProviders(
          settings.providers.map((provider) => ({
            ...provider,
            api_key: provider.api_key ?? '',
            model: provider.model ?? '',
          }))
        )
        setUpdatedAt(settings.updated_at)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load AI settings.'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const updateProvider = (index: number, patch: Partial<AIProviderConfig>) => {
    setProviders((prev) =>
      prev.map((provider, providerIndex) =>
        providerIndex === index ? { ...provider, ...patch } : provider
      )
    )
  }

  // Radio-button semantics: enabling one disables all others
  const setEnabledProvider = (index: number) => {
    setProviders((prev) =>
      prev.map((provider, providerIndex) => ({
        ...provider,
        enabled: providerIndex === index,
      }))
    )
  }

  const addProvider = () => {
    const suffix = providers.length + 1
    setProviders((prev) => [
      ...prev,
      {
        ...DEFAULT_PROVIDER,
        id: `provider_${suffix}`,
        name: `Provider ${suffix}`,
      },
    ])
  }

  const removeProvider = (index: number) => {
    setProviders((prev) => prev.filter((_, providerIndex) => providerIndex !== index))
  }

  const onSave = async () => {
    const cleanedProviders = providers.map((provider) => ({
      ...provider,
      id: provider.id.trim(),
      name: provider.name.trim(),
      base_url: provider.base_url.trim(),
      api_key: provider.api_key?.trim() || undefined,
      model: provider.model?.trim() || undefined,
    }))

    const hasEmptyRequired = cleanedProviders.some(
      (provider) => !provider.id || !provider.name || !provider.base_url
    )
    if (hasEmptyRequired) {
      toast.error('Each provider must include id, name, and base URL.')
      return
    }
    const cleanedProviderIdSet = new Set(cleanedProviders.map((provider) => provider.id))
    if (cleanedProviderIdSet.size !== cleanedProviders.length) {
      toast.error('Provider IDs must be unique.')
      return
    }

    setSaving(true)
    try {
      const saved = await patchAiSettings({ providers: cleanedProviders })
      setUpdatedAt(saved.updated_at)
      toast.success('AI settings saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI settings.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const onTestProvider = async (provider: AIProviderConfig) => {
    const providerId = provider.id.trim() || '(temporary-provider)'
    setTestingIds((prev) => ({ ...prev, [providerId]: true }))
    setTestResults((prev) => ({ ...prev, [providerId]: '' }))

    try {
      const result = await testAiProvider({
        provider: {
          ...provider,
          id: provider.id.trim(),
          name: provider.name.trim(),
          base_url: provider.base_url.trim(),
          api_key: provider.api_key?.trim() || undefined,
          model: provider.model?.trim() || undefined,
        },
      })
      const statusLabel = result.ok ? 'OK' : 'FAILED'
      setTestResults((prev) => ({
        ...prev,
        [providerId]: `${statusLabel} · ${result.latency_ms}ms · ${result.message}`,
      }))
      if (result.ok) {
        toast.success(`Provider ${providerId} is reachable.`)
      } else {
        toast.error(`Provider ${providerId} test failed.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider test failed.'
      setTestResults((prev) => ({ ...prev, [providerId]: `FAILED · ${message}` }))
      toast.error(message)
    } finally {
      setTestingIds((prev) => ({ ...prev, [providerId]: false }))
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">AI Settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure your AI provider. Exactly one provider can be active at a time.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            {updatedAt ? `Updated: ${updatedAt}` : 'Not saved yet'}
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading AI settings...</p>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-[0.15em] text-slate-600 uppercase">
                  Providers
                </h2>
                <button
                  type="button"
                  onClick={addProvider}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Add Provider
                </button>
              </div>

              {providers.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No providers configured. Add one to enable AI generation.
                </p>
              ) : null}

              <div className="space-y-3">
                {providers.map((provider, index) => {
                  const isActive = provider.enabled
                  const providerKey = `${provider.id}-${index}`
                  const testKey = provider.id.trim() || '(temporary-provider)'
                  return (
                    <article
                      key={providerKey}
                      className={`rounded-xl border-2 p-4 transition-colors ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {provider.name || '(unnamed)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => setEnabledProvider(index)}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onTestProvider(provider)}
                            disabled={Boolean(testingIds[testKey])}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {testingIds[testKey] ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProvider(index)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Provider ID</span>
                          <input
                            value={provider.id}
                            onChange={(event) =>
                              updateProvider(index, { id: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Display Name</span>
                          <input
                            value={provider.name}
                            onChange={(event) =>
                              updateProvider(index, { name: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Provider Kind</span>
                          <select
                            value={provider.kind}
                            onChange={(event) =>
                              updateProvider(index, {
                                kind: event.currentTarget.value as AIProviderKind,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          >
                            <option value="generic_json">generic_json</option>
                            <option value="openai_compatible">openai_compatible</option>
                          </select>
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Base URL</span>
                          <input
                            value={provider.base_url}
                            onChange={(event) =>
                              updateProvider(index, { base_url: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                            placeholder="https://api.openai.com/v1 or http://127.0.0.1:8080/generate"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">API Key (optional)</span>
                          <input
                            type="password"
                            value={provider.api_key ?? ''}
                            onChange={(event) =>
                              updateProvider(index, { api_key: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Model (optional)</span>
                          <input
                            value={provider.model ?? ''}
                            onChange={(event) =>
                              updateProvider(index, { model: event.currentTarget.value })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Timeout Seconds</span>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            step={1}
                            value={provider.timeout_seconds}
                            onChange={(event) =>
                              updateProvider(index, {
                                timeout_seconds: Number(event.currentTarget.value) || 20,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-slate-600">Temperature</span>
                          <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={provider.temperature}
                            onChange={(event) =>
                              updateProvider(index, {
                                temperature: Number(event.currentTarget.value) || 0.2,
                              })
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2"
                          />
                        </label>
                      </div>

                      {testResults[testKey] ? (
                        <p className="mt-2 text-xs text-slate-600">{testResults[testKey]}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="rounded-md border border-cyan-600 bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
```

**Step 2: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 8: Update `frontend/lib/api.ts` — remove routing from patchAiSettings call signature

**Files:**

- Modify: `frontend/lib/api.ts` (find the `patchAiSettings` function)

Check current signature. If it passes `routing`, update the call to only pass `providers`. The Zod schema change in Task 6 will already enforce this at type level.

**Step 1: Verify `patchAiSettings` accepts `PatchAISettingsRequest` which no longer has `routing`**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 9: Final verification + commit frontend

**Step 1: Run full backend test suite**

```bash
cd backend
uv run python -m pytest tests/ -q
```

Expected: all pass (37+)

**Step 2: Run frontend type check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors

**Step 3: Commit frontend changes**

```bash
git add frontend/lib/schemas.ts \
        frontend/components/settings/AISettingsPage.tsx \
        frontend/lib/api.ts
git commit -m "feat(settings): remove task routing UI, single-active provider with color indicator"
```

**Step 4: Commit design doc**

```bash
git add docs/plans/2026-02-20-ai-settings-simplify.md
git commit -m "docs: add ai-settings simplify design and plan"
```
