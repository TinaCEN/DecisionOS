import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { FeasibilityDetailClient } from '../FeasibilityDetailClient'
import { patchIdeaContext } from '../../../lib/api'
import { useIdeasStore } from '../../../lib/ideas-store'
import { useDecisionStore } from '../../../lib/store'
import { nextNavigationMock } from '../../../test/setup'

vi.mock('../../../lib/api', () => ({
  patchIdeaContext: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('FeasibilityDetailClient', () => {
  test('persists selected plan before navigating to scope freeze', async () => {
    const patchedContext = {
      session_id: 'session-1',
      created_at: '2026-02-20T00:00:00.000Z',
      idea_seed: 'seed',
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
      selected_plan_id: 'plan-a',
    }

    vi.mocked(patchIdeaContext).mockResolvedValue({
      id: 'idea-1',
      workspace_id: 'default',
      title: 'Idea 1',
      stage: 'scope_freeze',
      status: 'draft',
      version: 4,
      created_at: '2026-02-20T00:00:00.000Z',
      updated_at: '2026-02-20T00:00:00.000Z',
      context: patchedContext,
    })

    useIdeasStore.setState({
      activeIdeaId: 'idea-1',
      ideas: [
        {
          id: 'idea-1',
          workspace_id: 'default',
          title: 'Idea 1',
          stage: 'feasibility',
          status: 'draft',
          version: 3,
          created_at: '2026-02-20T00:00:00.000Z',
          updated_at: '2026-02-20T00:00:00.000Z',
        },
      ],
    })
    useDecisionStore.setState({
      context: {
        session_id: 'session-1',
        created_at: '2026-02-20T00:00:00.000Z',
        idea_seed: 'seed',
        feasibility: patchedContext.feasibility,
      },
    })
    nextNavigationMock.setPathname('/ideas/idea-1/feasibility/plan-a')

    render(<FeasibilityDetailClient planId="plan-a" />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm This Plan' }))

    await waitFor(() => {
      expect(patchIdeaContext).toHaveBeenCalledWith('idea-1', {
        version: 3,
        context: expect.objectContaining({
          selected_plan_id: 'plan-a',
        }),
      })
    })

    expect(nextNavigationMock.router.push).toHaveBeenCalledWith('/ideas/idea-1/scope-freeze')
  })
})
