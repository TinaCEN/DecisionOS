'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { ScopeBoard } from './ScopeBoard'
import { postIdeaScopedAgent } from '../../lib/api'
import { canOpenPrd, canOpenScope } from '../../lib/guards'
import { buildIdeaStepHref, resolveIdeaIdForRouting } from '../../lib/idea-routes'
import { useIdeasStore } from '../../lib/ideas-store'
import {
  scopeOutputSchema,
  type InScopeItem,
  type OutScopeItem,
  type ScopeInput,
  type ScopeOutput,
} from '../../lib/schemas'
import { useDecisionStore } from '../../lib/store'

export function ScopeFreezePage() {
  const router = useRouter()
  const pathname = usePathname()
  const context = useDecisionStore((state) => state.context)
  const setScope = useDecisionStore((state) => state.scope)
  const setScopeFrozen = useDecisionStore((state) => state.scopeFrozen)
  const activeIdeaId = useIdeasStore((state) => state.activeIdeaId)
  const activeIdea = useIdeasStore(
    (state) => state.ideas.find((idea) => idea.id === state.activeIdeaId) ?? null
  )
  const setIdeaVersion = useIdeasStore((state) => state.setIdeaVersion)
  const [inScope, setInScope] = useState<InScopeItem[]>(context.scope?.in_scope ?? [])
  const [outScope, setOutScope] = useState<OutScopeItem[]>(context.scope?.out_scope ?? [])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canOpen = canOpenScope(context)
  const canEnterPrd = canOpenPrd(context)
  const frozen = Boolean(context.scope_frozen)
  const routeIdeaId = resolveIdeaIdForRouting(pathname, activeIdeaId)

  const selectedDirection = useMemo(() => {
    if (!context.opportunity || !context.selected_direction_id) {
      return null
    }

    return (
      context.opportunity.directions.find(
        (direction) => direction.id === context.selected_direction_id
      ) ?? null
    )
  }, [context.opportunity, context.selected_direction_id])

  useEffect(() => {
    if (context.scope) {
      setInScope(context.scope.in_scope)
      setOutScope(context.scope.out_scope)
    }
  }, [context.scope])

  useEffect(() => {
    if (
      !canOpen ||
      !context.idea_seed ||
      !context.selected_direction_id ||
      !context.path_id ||
      !context.selected_plan_id ||
      !context.feasibility ||
      !selectedDirection
    ) {
      return
    }

    const payload: ScopeInput = {
      idea_seed: context.idea_seed,
      direction_id: context.selected_direction_id,
      direction_text: `${selectedDirection.title} - ${selectedDirection.one_liner}`,
      path_id: context.path_id,
      selected_plan_id: context.selected_plan_id,
      feasibility: context.feasibility,
    }
    if (!activeIdeaId || !activeIdea) {
      setErrorMessage('Missing active idea context')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    const run = async () => {
      try {
        const envelope = await postIdeaScopedAgent<ScopeInput & { version: number }, ScopeOutput>(
          activeIdeaId,
          'scope',
          {
            ...payload,
            version: activeIdea.version,
          }
        )
        setIdeaVersion(activeIdeaId, envelope.idea_version)
        const parsed = scopeOutputSchema.safeParse(envelope.data)

        if (!parsed.success) {
          throw new Error('Scope payload shape mismatch.')
        }

        setInScope(parsed.data.in_scope)
        setOutScope(parsed.data.out_scope)
        setScope(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed. Please try again.'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [
    activeIdea,
    activeIdeaId,
    canOpen,
    context.feasibility,
    context.idea_seed,
    context.path_id,
    context.selected_direction_id,
    context.selected_plan_id,
    pathname,
    selectedDirection,
    setScope,
    setIdeaVersion,
  ])

  if (!canOpen) {
    return (
      <main className="p-6">
        <GuardPanel
          title="Missing context for Scope Freeze"
          description="Confirm one feasibility plan before entering Scope Freeze."
        />
      </main>
    )
  }

  const handleScopeChange = (nextScope: ScopeOutput) => {
    if (frozen) {
      return
    }

    setInScope(nextScope.in_scope)
    setOutScope(nextScope.out_scope)
    setScope(nextScope)
  }

  return (
    <main>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 pt-6">
        <h1 className="text-2xl font-bold">Scope Freeze</h1>
        <p className="text-sm text-black/70">
          Drag cards between IN and OUT, reorder them, then freeze the scope when ready.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setScopeFrozen(!frozen)
              toast.success(!frozen ? 'Scope frozen' : 'Scope unlocked')
            }}
            className="rounded-md border border-black px-3 py-2 text-sm font-medium"
          >
            {frozen ? 'Unfreeze Scope' : 'Freeze Scope'}
          </button>
          <button
            type="button"
            onClick={() => {
              router.push(routeIdeaId ? buildIdeaStepHref(routeIdeaId, 'prd') : '/ideas')
            }}
            disabled={!canEnterPrd}
            className="rounded-md border border-cyan-600 bg-cyan-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to PRD
          </button>
          {loading ? <span className="text-xs text-black/60">Loading scope...</span> : null}
          {errorMessage ? <span className="text-xs text-red-600">{errorMessage}</span> : null}
        </div>
      </section>

      <ScopeBoard
        scope={{ in_scope: inScope, out_scope: outScope }}
        frozen={frozen}
        onScopeChange={handleScopeChange}
      />
    </main>
  )
}
