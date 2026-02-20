import { describe, expect, test } from 'vitest'

import { canOpenPrd, canOpenScope, canRunFeasibility } from '../guards'
import type { DecisionContext } from '../schemas'

const baseContext = (): DecisionContext => ({
  session_id: 'session-1',
  created_at: '2026-02-20T00:00:00.000Z',
})

const withSelectedPlan = (): DecisionContext => ({
  ...baseContext(),
  selected_plan_id: 'plan-a',
  feasibility: {
    plans: [
      {
        id: 'plan-a',
        name: 'Plan A',
        summary: 'Summary',
        score_overall: 7.3,
        scores: {
          technical_feasibility: 7,
          market_viability: 8,
          execution_risk: 7,
        },
        reasoning: {
          technical_feasibility: 'tech',
          market_viability: 'market',
          execution_risk: 'risk',
        },
        recommended_positioning: 'position',
      },
    ],
  },
})

describe('scope baseline guards', () => {
  test('canRunFeasibility depends on confirmed DAG path persistence', () => {
    expect(canRunFeasibility(baseContext())).toBe(false)
    expect(canRunFeasibility({ ...baseContext(), confirmed_dag_path_id: 'path-1' })).toBe(true)
  })

  test('canOpenScope when selected feasibility plan is persisted', () => {
    expect(canOpenScope(withSelectedPlan())).toBe(true)
  })

  test('canOpenPrd with frozen baseline pointer even without draft scope payload', () => {
    expect(
      canOpenPrd({
        ...withSelectedPlan(),
        current_scope_baseline_id: 'baseline-1',
        current_scope_baseline_version: 1,
        scope: undefined,
      })
    ).toBe(true)
  })

  test('canOpenPrd falls back to draft scope when baseline pointer is absent', () => {
    expect(
      canOpenPrd({
        ...withSelectedPlan(),
        scope: {
          in_scope: [{ id: 'in-1', title: 'MVP', desc: 'desc', priority: 'P1' }],
          out_scope: [{ id: 'out-1', title: 'Billing', desc: 'desc', reason: 'later' }],
        },
      })
    ).toBe(true)
  })
})
