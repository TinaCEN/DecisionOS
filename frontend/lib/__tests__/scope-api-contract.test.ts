import { describe, expect, test } from 'vitest'

import {
  scopeBaselineSchema,
  scopeBaselineOutSchema,
  scopeDraftResponseSchema,
  scopeDraftUpdateRequestSchema,
} from '../schemas'

describe('scope baseline API contract', () => {
  test('accepts draft scope response payload', () => {
    const parsed = scopeDraftResponseSchema.parse({
      readonly: false,
      baseline: {
        id: 'baseline-1',
        idea_id: 'idea-1',
        version: 1,
        status: 'draft',
        source_baseline_id: null,
        created_at: '2026-02-20T00:00:00.000Z',
        frozen_at: null,
      },
      items: [
        {
          id: 'item-1',
          baseline_id: 'baseline-1',
          lane: 'in',
          content: 'Core workflow',
          display_order: 0,
          created_at: '2026-02-20T00:00:00.000Z',
        },
      ],
    })

    expect(parsed.baseline.status).toBe('draft')
    expect(parsed.items[0]?.lane).toBe('in')
  })

  test('accepts frozen baseline payload', () => {
    const parsed = scopeBaselineSchema.parse({
      id: 'baseline-2',
      idea_id: 'idea-1',
      version: 2,
      status: 'frozen',
      source_baseline_id: 'baseline-1',
      created_at: '2026-02-20T00:00:00.000Z',
      frozen_at: '2026-02-20T00:10:00.000Z',
    })

    expect(parsed.status).toBe('frozen')
    expect(parsed.version).toBe(2)
  })

  test('accepts backend flat baseline payload with items', () => {
    const parsed = scopeBaselineOutSchema.parse({
      id: 'baseline-2',
      idea_id: 'idea-1',
      version: 2,
      status: 'frozen',
      source_baseline_id: 'baseline-1',
      created_at: '2026-02-20T00:00:00.000Z',
      frozen_at: '2026-02-20T00:10:00.000Z',
      items: [
        {
          id: 'item-1',
          baseline_id: 'baseline-2',
          lane: 'in',
          content: 'Core workflow',
          display_order: 0,
          created_at: '2026-02-20T00:00:00.000Z',
        },
      ],
    })

    expect(parsed.items[0]?.lane).toBe('in')
  })

  test('accepts draft update request payload', () => {
    const parsed = scopeDraftUpdateRequestSchema.parse({
      version: 6,
      items: [
        { lane: 'in', content: 'MVP onboarding', display_order: 0 },
        { lane: 'out', content: 'Billing v2', display_order: 0 },
      ],
    })

    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[1]?.lane).toBe('out')
  })
})
