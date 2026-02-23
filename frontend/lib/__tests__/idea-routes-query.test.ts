import { describe, expect, test } from 'vitest'

import { buildIdeaStepHref } from '../idea-routes'

describe('idea routes query params', () => {
  test('builds step href with query params', () => {
    const href = buildIdeaStepHref('idea-1', 'prd', {
      baseline_id: 'baseline-9',
      source: 'scope',
    })

    expect(href).toBe('/ideas/idea-1/prd?baseline_id=baseline-9&source=scope')
  })
})
