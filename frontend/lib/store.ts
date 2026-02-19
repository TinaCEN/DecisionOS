import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type {
  DirectionId,
  DecisionContext,
  FeasibilityOutput,
  OpportunityOutput,
  PathId,
  PrdOutput,
  ScopeOutput,
} from './schemas'

type DecisionStore = {
  context: DecisionContext
  idea: (ideaSeed: string) => void
  opportunity: (opportunity: OpportunityOutput) => void
  direction: (directionId: DirectionId) => void
  path: (pathId: PathId) => void
  feasibility: (feasibility: FeasibilityOutput) => void
  plan: (planId: string) => void
  scope: (scope: ScopeOutput) => void
  scopeFrozen: (frozen: boolean) => void
  prd: (prd: PrdOutput) => void
  reset: () => void
}

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}`
}

export const createInitialContext = (): DecisionContext => ({
  session_id: createSessionId(),
  created_at: new Date().toISOString(),
  scope_frozen: false,
})

export const useDecisionStore = create<DecisionStore>()(
  persist(
    (set) => ({
      context: createInitialContext(),
      idea: (ideaSeed) =>
        set((state) => ({
          context: {
            ...state.context,
            idea_seed: ideaSeed,
            opportunity: undefined,
            selected_direction_id: undefined,
            path_id: undefined,
            feasibility: undefined,
            selected_plan_id: undefined,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      opportunity: (opportunity) =>
        set((state) => ({
          context: {
            ...state.context,
            opportunity,
            selected_direction_id: undefined,
            path_id: undefined,
            feasibility: undefined,
            selected_plan_id: undefined,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      direction: (directionId) =>
        set((state) => ({
          context: {
            ...state.context,
            selected_direction_id: directionId,
            feasibility: undefined,
            selected_plan_id: undefined,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      path: (pathId) =>
        set((state) => ({
          context: {
            ...state.context,
            path_id: pathId,
            feasibility: undefined,
            selected_plan_id: undefined,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      feasibility: (feasibility) =>
        set((state) => ({
          context: {
            ...state.context,
            feasibility,
            selected_plan_id: undefined,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      plan: (planId) =>
        set((state) => ({
          context: {
            ...state.context,
            selected_plan_id: planId,
            scope: undefined,
            scope_frozen: false,
            prd: undefined,
          },
        })),
      scope: (scope) =>
        set((state) => ({
          context: {
            ...state.context,
            scope,
            prd: undefined,
          },
        })),
      scopeFrozen: (frozen) =>
        set((state) => ({
          context: {
            ...state.context,
            scope_frozen: frozen,
          },
        })),
      prd: (prd) =>
        set((state) => ({
          context: {
            ...state.context,
            prd,
          },
        })),
      reset: () => set({ context: createInitialContext() }),
    }),
    {
      name: 'decisionos_context_v1',
      skipHydration: true,
      partialize: (state) => ({
        context: state.context,
      }),
    }
  )
)
