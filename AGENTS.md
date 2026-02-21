# AGENTS.md — DecisionOS Architecture Guardrails (v2)

本文件定义当前仓库的执行边界与架构约束。目标是把 DecisionOS 从单 idea 流程升级为单用户、单 workspace、多 ideas 的可持续产品底座。

## 1. Product Scope (Current)

- 用户模型：默认单用户。
- 工作区模型：默认单 workspace（系统自动创建 `default`）。
- 业务主体：`idea` 是一等实体，一个 workspace 下必须支持多个 ideas。
- 每个 idea 都有独立决策流程：
  - Idea Canvas
  - Feasibility
  - Scope Freeze
  - PRD

## 2. Non-Negotiable Architecture

### 2.1 Backend

- 必须使用 SQLite 做持久化（可迁移到 Postgres）。
- 必须有 `workspace` 与 `idea` 表；`idea` 存储完整 `context_json` 与 `version`。
- 所有 agent 能力都必须按 `idea_id` 作用域执行并落库。
- 所有写操作（包含 agent 生成）都必须做版本冲突保护（optimistic locking）。
- 保持 FastAPI + Pydantic，JSON/SSE 输出结构与前端 schema 对齐。
- 归档以 `status` 为唯一真源，`archived_at` 只做派生审计字段并保持一致性约束。

### 2.2 Frontend

- 不再以全局单例 `context` 作为最终真源。
- 前端必须有 idea 列表与 idea 切换能力。
- 决策页面必须是 idea-scoped 路由（`/ideas/[ideaId]/...`）。
- Zustand 可用于 UI cache，但后端是持久化真源。

## 3. Data Model Requirements

### Workspace

- `id`, `name`, `created_at`, `updated_at`

### Idea

- `id`, `workspace_id`, `title`, `idea_seed`
- `stage`, `status`
- `context_json`, `version`
- `created_at`, `updated_at`, `archived_at`

### IdeaNode (DAG Canvas)

- `id`, `idea_id`, `parent_id` (NULL = root)
- `content`, `expansion_pattern`, `edge_label`, `depth`
- `status` (`active` only — `confirmed` and `pruned` are reserved but not yet used in application logic), `created_at`

### IdeaPath (Confirmed Decision Path)

- `id`, `idea_id`
- `node_chain` (JSON array of node ids, root → leaf)
- `path_md` (Markdown narrative, LLM context for Feasibility/PRD)
- `path_json` (structured JSON with node chain + AI summary)
- `created_at`

## 4. API Baseline

- `GET /ideas`
- `POST /ideas`
- `GET /ideas/{idea_id}`
- `PATCH /ideas/{idea_id}`
- `PATCH /ideas/{idea_id}/context`

约束：

- `GET /ideas` 固定排序 `updated_at DESC, id DESC`，cursor 格式必须稳定，`status` 过滤语义必须覆盖 `draft|active|frozen|archived`。
- `POST /ideas` 必须写入 canonical default context（含 schema version）。
- `PATCH /ideas/{idea_id}` 不接收独立 `archived` 布尔值，使用 `status` 统一控制归档，且必须携带 `version`。

Agent 路由必须迁移为 idea-scoped：

- `/ideas/{idea_id}/agents/opportunity`
- `/ideas/{idea_id}/agents/opportunity/stream`
- `/ideas/{idea_id}/agents/feasibility`
- `/ideas/{idea_id}/agents/feasibility/stream`
- `/ideas/{idea_id}/agents/scope`
- `/ideas/{idea_id}/agents/prd`
- `/ideas/{idea_id}/prd/feedback`

DAG canvas 路由（idea-scoped）：

- `GET /ideas/{idea_id}/nodes`
- `POST /ideas/{idea_id}/nodes`
- `GET /ideas/{idea_id}/nodes/{node_id}`
- `POST /ideas/{idea_id}/nodes/{node_id}/expand/user`
- `POST /ideas/{idea_id}/nodes/{node_id}/expand/stream`
- `POST /ideas/{idea_id}/paths`
- `GET /ideas/{idea_id}/paths/latest`

Agent 契约：

- `idea_id` 仅存在于 route，不在 request body 重复。
- mutating request 必须携带 `version`。
- **PRD V2 生成**（`/agents/prd`）请求体最小化为 `{ version, baseline_id }`，后端必须组装 context pack（step2 + step3 + step4）：
  - step2: `idea_paths` latest (`path_md/path_json/summary`)
  - step3: `context.feasibility` + `selected_plan_id`（完整 scores/reasoning/positioning）
  - step4: frozen baseline（`baseline_id`）+ scope detail 映射
- `/agents/prd` 响应 envelope 保持 `{ idea_id, idea_version, data }`，`data` 必须包含：
  - `markdown`
  - `sections[]`
  - `requirements[]`
  - `backlog.items[]`（每项包含 `requirement_id`，可追溯到 requirement）
  - `generation_meta`
- **PRD 严格失败语义**：
  - `LLM_MODE=mock` 可用 mock
  - `LLM_MODE!=mock` 禁止静默 fallback 到 mock
  - provider/schema 失败返回 `502` + `detail.code = PRD_GENERATION_FAILED`
- **PRD 反馈（latest-only）**：`POST /ideas/{idea_id}/prd/feedback`
  - request: `{ version, baseline_id, rating_overall, rating_dimensions, comment? }`
  - 仅保留 `context.prd_feedback_latest` 一条最新记录
  - 成功写入必须做 CAS 并 bump `idea.version`
- **普通 agent SSE**（opportunity/feasibility stream）response 使用固定 envelope：`{ idea_id, idea_version, data }`，`done` 事件落库并 bump 版本，`partial` 事件不落库；`done` 落库必须做 compare-and-swap（version 一致性检查）。
- **DAG 扩展 SSE**（`/nodes/{node_id}/expand/stream`）使用不同格式（named events），**不**携带 `idea_version`，**不** bump 版本：

  ```
  event: progress
  data: {"step": "generating", "pct": 10}

  event: done
  data: {"idea_id": "...", "nodes": [{...IdeaNodeOut...}]}

  event: error
  data: {"code": "EXPAND_FAILED", "message": "..."}
  ```

  前端通过 `streamPost` 工具函数消费此 SSE，而非 `EventSource`。

DAG 路径确认副作用：

- `POST /ideas/{idea_id}/paths` 在创建 `idea_paths` 行后，会通过 `apply_agent_update` 将 `confirmed_dag_path_id` 写入 `idea.context_json`。
- `confirmed_dag_path_id` 是解锁 Feasibility 阶段的唯一条件：`infer_stage_from_context` 检测到此字段非 null 时返回 `"feasibility"`；前端 `canRunFeasibility` 直接检查该字段。

已知坑（历史 bug 记录，供未来 agent 参考）：

- **React 18 StrictMode 双重 mount**：`useEffect` 在 dev 模式下会执行两次。如果 init effect 内含异步创建操作（如 `createRootNode`），两次执行均可能在首次响应返回前看到"无节点"状态，导致双重创建。解决方案：(1) 在 cleanup 函数中设置 `cancelled` flag 并在 async 函数内检查；(2) 后端 `POST /ideas/{idea_id}/nodes` 做幂等处理（若已有节点则返回现有根节点）。两者都必须同时存在。
- **空 ideaSeed 导致 422**：新建 idea 时 `idea.idea_seed` 可能为 `null`。页面传递给 `IdeaDAGCanvas` 时必须使用 `idea.idea_seed ?? idea.title` 作为 fallback，否则会向后端发送空字符串，触发 `CreateRootNodeRequest.content` 的 `min_length=1` 校验失败。

## 5. Vector Search Readiness (Reserved)

当前阶段不强制接入向量数据库，但必须预留：

- idea context 更新事件（例如 `IDEA_CONTEXT_UPDATED`）
- chunk 级文本抽取接口（seed/direction/plan/scope/prd）
- 未来语义检索接口占位（可先返回 501）

## 6. Execution Principles

- 小步提交，先保证数据模型与 API 稳定，再改 UI。
- 新功能优先补契约测试（schema + endpoint）。
- 若文档与代码冲突，以最新 `docs/plans/*multi-idea*` 设计文档为准并同步更新本文件。

## 7. Source of Truth Documents

- Architecture design: `docs/plans/2026-02-20-single-workspace-multi-idea-sqlite.md`
- Project readme: `README.md`
