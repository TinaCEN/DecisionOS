import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ScopeFreezePage } from '../ScopeFreezePage'
import { useIdeasStore } from '../../../lib/ideas-store'
import { useDecisionStore } from '../../../lib/store'
import { nextNavigationMock } from '../../../test/setup'
import {
  bootstrapScopeDraft,
  createScopeNewVersion,
  freezeScope,
  getScopeDraft,
  patchIdeaContext,
  patchScopeDraft,
} from '../../../lib/api'

vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>()
  return {
    ...actual,
    getScopeDraft: vi.fn(),
    bootstrapScopeDraft: vi.fn(),
    patchScopeDraft: vi.fn(),
    freezeScope: vi.fn(),
    createScopeNewVersion: vi.fn(),
    patchIdeaContext: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

const draftData = {
  readonly: false,
  baseline: {
    id: 'baseline-1',
    idea_id: 'idea-1',
    version: 1,
    status: 'draft' as const,
    source_baseline_id: null,
    created_at: '2026-02-20T00:00:00.000Z',
    frozen_at: null,
  },
  items: [
    {
      id: 'item-in',
      baseline_id: 'baseline-1',
      lane: 'in' as const,
      content: 'Core workflow',
      display_order: 0,
      created_at: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'item-out',
      baseline_id: 'baseline-1',
      lane: 'out' as const,
      content: 'Billing v2',
      display_order: 0,
      created_at: '2026-02-20T00:00:00.000Z',
    },
  ],
}

const initStores = () => {
  useIdeasStore.setState({
    activeIdeaId: 'idea-1',
    ideas: [
      {
        id: 'idea-1',
        workspace_id: 'default',
        title: 'Idea 1',
        stage: 'scope_freeze',
        status: 'draft',
        version: 7,
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
    },
  })
  nextNavigationMock.setPathname('/ideas/idea-1/scope-freeze')
}

describe('ScopeFreezePage baseline flow', () => {
  beforeEach(() => {
    initStores()
    vi.mocked(getScopeDraft).mockResolvedValue(draftData)
    vi.mocked(patchIdeaContext).mockResolvedValue({
      id: 'idea-1',
      workspace_id: 'default',
      title: 'Idea 1',
      stage: 'scope_freeze',
      status: 'draft',
      version: 9,
      created_at: '2026-02-20T00:00:00.000Z',
      updated_at: '2026-02-20T00:00:00.000Z',
      context: useDecisionStore.getState().context,
    })
  })

  test('loads scope draft and renders both lanes', async () => {
    render(<ScopeFreezePage />)

    await waitFor(() => {
      expect(getScopeDraft).toHaveBeenCalledWith('idea-1')
    })

    expect(await screen.findByText('Core workflow')).toBeInTheDocument()
    expect(screen.getByText('Billing v2')).toBeInTheDocument()
  })

  test('freezes draft and allows creating new version', async () => {
    vi.mocked(freezeScope).mockResolvedValue({
      idea_id: 'idea-1',
      idea_version: 8,
      data: {
        ...draftData,
        readonly: true,
        baseline: {
          ...draftData.baseline,
          status: 'frozen',
          frozen_at: '2026-02-20T00:20:00.000Z',
        },
      },
    })
    vi.mocked(createScopeNewVersion).mockResolvedValue({
      idea_id: 'idea-1',
      idea_version: 9,
      data: {
        ...draftData,
        baseline: {
          ...draftData.baseline,
          id: 'baseline-2',
          version: 2,
          source_baseline_id: 'baseline-1',
        },
      },
    })

    render(<ScopeFreezePage />)
    await screen.findByText('Core workflow')

    await userEvent.click(screen.getByRole('button', { name: 'Freeze Baseline' }))
    await waitFor(() => {
      expect(freezeScope).toHaveBeenCalledWith('idea-1', { version: 7 })
    })
    expect(await screen.findByRole('button', { name: 'Create New Version' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create New Version' }))
    await waitFor(() => {
      expect(createScopeNewVersion).toHaveBeenCalledWith('idea-1', { version: 8 })
    })
  })

  test('adds and deletes draft item via patch API', async () => {
    const withAddedItem = {
      ...draftData,
      items: [
        ...draftData.items,
        {
          id: 'item-new',
          baseline_id: 'baseline-1',
          lane: 'in' as const,
          content: 'MVP onboarding',
          display_order: 1,
          created_at: '2026-02-20T00:00:00.000Z',
        },
      ],
    }
    vi.mocked(patchScopeDraft)
      .mockResolvedValueOnce({
        idea_id: 'idea-1',
        idea_version: 8,
        data: withAddedItem,
      })
      .mockResolvedValueOnce({
        idea_id: 'idea-1',
        idea_version: 9,
        data: draftData,
      })

    render(<ScopeFreezePage />)
    await screen.findByText('Core workflow')

    await userEvent.type(screen.getByLabelText('Add item to IN scope'), 'MVP onboarding')
    await userEvent.click(screen.getByRole('button', { name: 'Add IN Item' }))

    await waitFor(() => {
      expect(patchScopeDraft).toHaveBeenCalledWith(
        'idea-1',
        expect.objectContaining({
          version: 7,
          items: expect.arrayContaining([
            expect.objectContaining({ lane: 'in', content: 'MVP onboarding' }),
          ]),
        })
      )
    })

    await userEvent.click(screen.getByRole('button', { name: 'Delete MVP onboarding' }))
    await waitFor(() => {
      expect(patchScopeDraft).toHaveBeenCalledTimes(2)
    })
  })

  test('bootstraps draft when no draft exists', async () => {
    vi.mocked(getScopeDraft).mockRejectedValueOnce(
      Object.assign(new Error('Request failed with 404'), { status: 404 })
    )
    vi.mocked(bootstrapScopeDraft).mockResolvedValueOnce({
      idea_id: 'idea-1',
      idea_version: 8,
      data: draftData,
    })

    render(<ScopeFreezePage />)
    await waitFor(() => {
      expect(bootstrapScopeDraft).toHaveBeenCalledWith('idea-1', { version: 7 })
    })
  })
})
