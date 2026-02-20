import { z } from 'zod'

export const directionIdSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F'])
export const pathIdSchema = z.enum(['pathA', 'pathB', 'pathC'])
export const prioritySchema = z.enum(['P0', 'P1', 'P2'])
export const OPPORTUNITY_MIN_COUNT = 1
export const OPPORTUNITY_MAX_COUNT = 6
export const OPPORTUNITY_DEFAULT_COUNT = 3

export const directionSchema = z.object({
  id: directionIdSchema,
  title: z.string().min(1),
  one_liner: z.string().min(1),
  pain_tags: z.array(z.string().min(1)),
})

export const opportunityInputSchema = z.object({
  idea_seed: z.string().min(1),
  count: z
    .number()
    .int()
    .min(OPPORTUNITY_MIN_COUNT)
    .max(OPPORTUNITY_MAX_COUNT)
    .default(OPPORTUNITY_DEFAULT_COUNT),
})

export const opportunityOutputSchema = z.object({
  directions: z.array(directionSchema).min(OPPORTUNITY_MIN_COUNT).max(OPPORTUNITY_MAX_COUNT),
})

export const pathOptionSchema = z.object({
  id: pathIdSchema,
  name: z.string().min(1),
  focus: z.string().min(1),
})

export const PATHS = [
  { id: 'pathA', name: 'Feature Definition Path', focus: 'What to build' },
  { id: 'pathB', name: 'Decision Compression Path', focus: 'What not to build' },
  { id: 'pathC', name: 'Rapid Validation Path', focus: 'Smallest demoable slice' },
] satisfies Array<z.infer<typeof pathOptionSchema>>

export const scoreBreakdownSchema = z.object({
  technical_feasibility: z.number().min(0).max(10),
  market_viability: z.number().min(0).max(10),
  execution_risk: z.number().min(0).max(10),
})

export const reasoningBreakdownSchema = z.object({
  technical_feasibility: z.string().min(1),
  market_viability: z.string().min(1),
  execution_risk: z.string().min(1),
})

export const feasibilityPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  score_overall: z.number().min(0).max(10),
  scores: scoreBreakdownSchema,
  reasoning: reasoningBreakdownSchema,
  recommended_positioning: z.string().min(1),
})

export const feasibilityInputSchema = z.object({
  idea_seed: z.string().min(1),
  direction_id: directionIdSchema,
  direction_text: z.string().min(1),
  path_id: pathIdSchema,
})

export const feasibilityOutputSchema = z.object({
  plans: z.array(feasibilityPlanSchema).length(3),
})

export const inScopeItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  desc: z.string().min(1),
  priority: prioritySchema,
})

export const outScopeItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  desc: z.string().min(1),
  reason: z.string().min(1),
})

export const scopeInputSchema = z.object({
  idea_seed: z.string().min(1),
  direction_id: directionIdSchema,
  direction_text: z.string().min(1),
  path_id: pathIdSchema,
  selected_plan_id: z.string().min(1),
  feasibility: feasibilityOutputSchema,
})

export const scopeOutputSchema = z.object({
  in_scope: z.array(inScopeItemSchema),
  out_scope: z.array(outScopeItemSchema),
})

export const prdSectionsSchema = z.object({
  problem_statement: z.string().min(1),
  target_user: z.string().min(1),
  core_workflow: z.string().min(1),
  mvp_scope: z.string().min(1),
  success_metrics: z.string().min(1),
  risk_analysis: z.string().min(1),
})

export const prdInputSchema = z.object({
  idea_seed: z.string().min(1),
  direction_text: z.string().min(1),
  selected_plan_id: z.string().min(1),
  scope: scopeOutputSchema,
})

export const prdOutputSchema = z.object({
  markdown: z.string(),
  sections: prdSectionsSchema,
})

export const ideaStageSchema = z.enum(['idea_canvas', 'feasibility', 'scope_freeze', 'prd'])

export const ideaStatusSchema = z.enum(['draft', 'active', 'frozen', 'archived'])

export const ideaSummarySchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  title: z.string().min(1),
  idea_seed: z.string().nullable().optional(),
  stage: ideaStageSchema,
  status: ideaStatusSchema,
  version: z.number().int().nonnegative(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  archived_at: z.string().nullable().optional(),
})

export const decisionContextSchema = z.object({
  session_id: z.string().min(1),
  created_at: z.string().min(1),
  context_schema_version: z.number().int().positive().optional(),
  idea_seed: z.string().min(1).optional(),
  opportunity: opportunityOutputSchema.optional(),
  selected_direction_id: directionIdSchema.optional(),
  path_id: pathIdSchema.optional(),
  feasibility: feasibilityOutputSchema.optional(),
  selected_plan_id: z.string().min(1).optional(),
  scope: scopeOutputSchema.optional(),
  scope_frozen: z.boolean().optional(),
  prd: prdOutputSchema.optional(),
  confirmed_dag_path_id: z.string().optional(),
})

export const ideaDetailSchema = ideaSummarySchema.extend({
  context: decisionContextSchema,
})

export const ideasListResponseSchema = z.object({
  items: z.array(ideaSummarySchema),
  next_cursor: z.string().nullable().optional(),
})

export const createIdeaRequestSchema = z.object({
  title: z.string().min(1),
  idea_seed: z.string().optional(),
})

export const patchIdeaRequestSchema = z.object({
  title: z.string().min(1).optional(),
  status: ideaStatusSchema.optional(),
  version: z.number().int().nonnegative(),
})

export const patchIdeaContextRequestSchema = z.object({
  context: decisionContextSchema,
  version: z.number().int().nonnegative(),
})

export const agentEnvelopeSchema = z.object({
  idea_id: z.string().min(1),
  idea_version: z.number().int().nonnegative(),
  data: z.unknown(),
})

export const aiProviderKindSchema = z.enum(['generic_json', 'openai_compatible'])

export const aiProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: aiProviderKindSchema,
  base_url: z.string().min(1),
  api_key: z.string().optional(),
  model: z.string().optional(),
  enabled: z.boolean().default(true),
  timeout_seconds: z.number().min(1).max(120).default(20),
  temperature: z.number().min(0).max(2).default(0.2),
})

export const aiSettingsSchema = z.object({
  id: z.string().min(1),
  providers: z.array(aiProviderConfigSchema),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
})

export const patchAiSettingsRequestSchema = z.object({
  providers: z.array(aiProviderConfigSchema),
})

export const testAiProviderRequestSchema = z.object({
  provider: aiProviderConfigSchema,
})

export const testAiProviderResponseSchema = z.object({
  ok: z.boolean(),
  latency_ms: z.number().int().nonnegative(),
  message: z.string().min(1),
})

export type DirectionId = z.infer<typeof directionIdSchema>
export type PathId = z.infer<typeof pathIdSchema>
export type Priority = z.infer<typeof prioritySchema>
export type Direction = z.infer<typeof directionSchema>
export type OpportunityInput = z.infer<typeof opportunityInputSchema>
export type OpportunityOutput = z.infer<typeof opportunityOutputSchema>
export type PathOption = z.infer<typeof pathOptionSchema>
export type FeasibilityScores = z.infer<typeof scoreBreakdownSchema>
export type FeasibilityReasoning = z.infer<typeof reasoningBreakdownSchema>
export type FeasibilityPlan = z.infer<typeof feasibilityPlanSchema>
export type FeasibilityInput = z.infer<typeof feasibilityInputSchema>
export type FeasibilityOutput = z.infer<typeof feasibilityOutputSchema>
export type InScopeItem = z.infer<typeof inScopeItemSchema>
export type OutScopeItem = z.infer<typeof outScopeItemSchema>
export type ScopeInput = z.infer<typeof scopeInputSchema>
export type ScopeOutput = z.infer<typeof scopeOutputSchema>
export type PrdSections = z.infer<typeof prdSectionsSchema>
export type PrdInput = z.infer<typeof prdInputSchema>
export type PrdOutput = z.infer<typeof prdOutputSchema>
export type DecisionContext = z.infer<typeof decisionContextSchema>
export type IdeaStage = z.infer<typeof ideaStageSchema>
export type IdeaStatus = z.infer<typeof ideaStatusSchema>
export type IdeaSummary = z.infer<typeof ideaSummarySchema>
export type IdeaDetail = z.infer<typeof ideaDetailSchema>
export type IdeasListResponse = z.infer<typeof ideasListResponseSchema>
export type CreateIdeaRequest = z.infer<typeof createIdeaRequestSchema>
export type PatchIdeaRequest = z.infer<typeof patchIdeaRequestSchema>
export type PatchIdeaContextRequest = z.infer<typeof patchIdeaContextRequestSchema>
export type AgentEnvelope = z.infer<typeof agentEnvelopeSchema>
export type AIProviderKind = z.infer<typeof aiProviderKindSchema>
export type AIProviderConfig = z.infer<typeof aiProviderConfigSchema>
export type AISettings = z.infer<typeof aiSettingsSchema>
export type PatchAISettingsRequest = z.infer<typeof patchAiSettingsRequestSchema>
export type TestAIProviderRequest = z.infer<typeof testAiProviderRequestSchema>
export type TestAIProviderResponse = z.infer<typeof testAiProviderResponseSchema>
