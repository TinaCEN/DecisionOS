import { z } from 'zod'

export const directionIdSchema = z.enum(['A', 'B', 'C'])
export const pathIdSchema = z.enum(['pathA', 'pathB', 'pathC'])
export const prioritySchema = z.enum(['P0', 'P1', 'P2'])

export const directionSchema = z.object({
  id: directionIdSchema,
  title: z.string().min(1),
  one_liner: z.string().min(1),
  pain_tags: z.array(z.string().min(1)),
})

export const opportunityInputSchema = z.object({
  idea_seed: z.string().min(1),
})

export const opportunityOutputSchema = z.object({
  directions: z.array(directionSchema).length(3),
})

export const pathOptionSchema = z.object({
  id: pathIdSchema,
  name: z.string().min(1),
  focus: z.string().min(1),
})

export const PATHS = [
  { id: 'pathA', name: '功能定义路径', focus: '做什么' },
  { id: 'pathB', name: '决策压缩路径', focus: '不做什么' },
  { id: 'pathC', name: '快速验证路径', focus: '最小可演示' },
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

export const decisionContextSchema = z.object({
  session_id: z.string().min(1),
  created_at: z.string().min(1),
  idea_seed: z.string().min(1).optional(),
  opportunity: opportunityOutputSchema.optional(),
  selected_direction_id: directionIdSchema.optional(),
  path_id: pathIdSchema.optional(),
  feasibility: feasibilityOutputSchema.optional(),
  selected_plan_id: z.string().min(1).optional(),
  scope: scopeOutputSchema.optional(),
  scope_frozen: z.boolean().optional(),
  prd: prdOutputSchema.optional(),
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
