'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { GuardPanel } from '../../components/common/GuardPanel'
import { ScopeBoard } from '../../components/scope/ScopeBoard'
import { jsonPost } from '../../lib/api'
import { canOpenScope } from '../../lib/guards'
import {
  scopeOutputSchema,
  type InScopeItem,
  type OutScopeItem,
  type ScopeInput,
  type ScopeOutput,
} from '../../lib/schemas'
import { useDecisionStore } from '../../lib/store'

export default function ScopeFreezePage() {
  const context = useDecisionStore((state) => state.context)
  const setScope = useDecisionStore((state) => state.scope)
  const setScopeFrozen = useDecisionStore((state) => state.scopeFrozen)
  const [inScope, setInScope] = useState<InScopeItem[]>(context.scope?.in_scope ?? [])
  const [outScope, setOutScope] = useState<OutScopeItem[]>(context.scope?.out_scope ?? [])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canOpen = canOpenScope(context)
  const frozen = Boolean(context.scope_frozen)

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

    setLoading(true)
    setErrorMessage(null)

    const run = async () => {
      try {
        const output = await jsonPost<ScopeInput, unknown>('/agents/scope', payload)
        const parsed = scopeOutputSchema.safeParse(output)

        if (!parsed.success) {
          throw new Error('Scope payload shape mismatch.')
        }

        setInScope(parsed.data.in_scope)
        setOutScope(parsed.data.out_scope)
        setScope(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : '请求失败，请稍后重试。'
        setErrorMessage(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [
    canOpen,
    context.feasibility,
    context.idea_seed,
    context.path_id,
    context.selected_direction_id,
    context.selected_plan_id,
    selectedDirection,
    setScope,
  ])

  if (!canOpen) {
    return (
      <main className="p-6">
        <GuardPanel
          title="Missing context for Scope Freeze"
          description="Scope Freeze 需要先在 Feasibility 里确认一个计划。"
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
          拖拽卡片可在 IN/OUT 之间迁移并排序；Freeze 后将锁定布局。
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
