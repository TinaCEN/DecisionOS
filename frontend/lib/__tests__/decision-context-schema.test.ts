import { describe, expect, test } from 'vitest'

import { decisionContextSchema } from '../schemas'

describe('decisionContextSchema', () => {
  test('strips legacy selected_direction_id and path_id fields from payload', () => {
    const parsed = decisionContextSchema.parse({
      session_id: 'session-1',
      created_at: '2026-02-20T00:00:00.000Z',
      selected_direction_id: 'A',
      path_id: 'pathA',
    })

    expect(parsed).not.toHaveProperty('selected_direction_id')
    expect(parsed).not.toHaveProperty('path_id')
  })
})
