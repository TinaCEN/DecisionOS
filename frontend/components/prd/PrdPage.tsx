'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { PrdView } from './PrdView'
import { getScopeBaseline, postIdeaScopedAgent } from '../../lib/api'
import { buildConfirmedPathContext, getLatestPath } from '../../lib/dag-api'
import { canOpenPrd } from '../../lib/guards'
import { useIdeasStore } from '../../lib/ideas-store'
import {
  prdOutputSchema,
  type ConfirmedPathContext,
  type DecisionContext,
  type ScopeBaselineResponse,
  type ScopeOutput,
  type PrdInput,
  type PrdOutput,
} from '../../lib/schemas'
import { useDecisionStore } from '../../lib/store'

const isPrdStale = (
  context: DecisionContext,
  confirmedPathContext: ConfirmedPathContext
): boolean => {
  if (!context.prd) {
    return true
  }

  if (context.confirmed_dag_path_id !== confirmedPathContext.confirmed_path_id) {
    return true
  }
  if (context.confirmed_dag_node_id !== confirmedPathContext.confirmed_node_id) {
    return true
  }
  if (context.confirmed_dag_node_content !== confirmedPathContext.confirmed_node_content) {
    return true
  }
  return (
    (context.confirmed_dag_path_summary ?? null) !==
    (confirmedPathContext.confirmed_path_summary ?? null)
  )
}

const toScopeOutputFromBaseline = (baseline: ScopeBaselineResponse): ScopeOutput => {
  const inScopeItems = baseline.items
    .filter((item) => item.lane === 'in')
    .sort((left, right) => left.display_order - right.display_order)
    .map((item) => ({
      id: item.id,
      title: item.content,
      desc: item.content,
      priority: 'P1' as const,
    }))
  const outScopeItems = baseline.items
    .filter((item) => item.lane === 'out')
    .sort((left, right) => left.display_order - right.display_order)
    .map((item) => ({
      id: item.id,
      title: item.content,
      desc: item.content,
      reason: 'Excluded from frozen baseline',
    }))

  return {
    in_scope: inScopeItems,
    out_scope: outScopeItems,
  }
}

type PrdPageProps = {
  baselineId?: string | null
}

export function PrdPage({ baselineId: baselineIdProp = null }: PrdPageProps) {
  const searchParams = useSearchParams()
  const context = useDecisionStore((state) => state.context)
  const setPrd = useDecisionStore((state) => state.prd)
  const canOpen = canOpenPrd(context)
  const activeIdeaId = useIdeasStore((state) => state.activeIdeaId)
  const activeIdea = useIdeasStore(
    (state) => state.ideas.find((idea) => idea.id === state.activeIdeaId) ?? null
  )
  const setIdeaVersion = useIdeasStore((state) => state.setIdeaVersion)
  const [confirmedPathContext, setConfirmedPathContext] = useState<ConfirmedPathContext | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scopeNotice, setScopeNotice] = useState<string | null>(null)
  const [resolvedScope, setResolvedScope] = useState<ScopeOutput | null>(null)
  const inFlightGenerationKeyRef = useRef<string | null>(null)
  const completedGenerationKeyRef = useRef<string | null>(null)
  const baselineId = baselineIdProp ?? searchParams.get('baseline_id')

  useEffect(() => {
    if (!canOpen || !activeIdeaId) {
      setResolvedScope(context.scope ?? null)
      setScopeNotice(null)
      return
    }

    if (!baselineId) {
      setResolvedScope(context.scope ?? null)
      setScopeNotice('Using draft scope because no frozen baseline is selected.')
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const baseline = await getScopeBaseline(activeIdeaId, baselineId)
        if (!cancelled) {
          setResolvedScope(toScopeOutputFromBaseline(baseline))
          setScopeNotice(null)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load frozen baseline. Falling back to draft scope.'
          setResolvedScope(context.scope ?? null)
          setScopeNotice(message)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeIdeaId, baselineId, canOpen, context.scope])

  useEffect(() => {
    if (!canOpen || !activeIdeaId) {
      setConfirmedPathContext(null)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const latestPath = await getLatestPath(activeIdeaId)
        if (!latestPath) {
          throw new Error('No confirmed DAG path found. Please confirm a path in Idea Canvas.')
        }
        const next = buildConfirmedPathContext(latestPath)
        if (!next) {
          throw new Error('Confirmed path payload is invalid. Re-confirm the DAG path.')
        }
        if (!cancelled) {
          setErrorMessage(null)
          setConfirmedPathContext(next)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Failed to load confirmed DAG path.'
          setErrorMessage(message)
          setConfirmedPathContext(null)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeIdeaId, canOpen, context.confirmed_dag_path_id])

  useEffect(() => {
    if (
      !canOpen ||
      !activeIdeaId ||
      !activeIdea ||
      !context.idea_seed ||
      !context.selected_plan_id ||
      !resolvedScope ||
      !confirmedPathContext
    ) {
      return
    }

    const generationKey = JSON.stringify({
      confirmed_path_id: confirmedPathContext.confirmed_path_id,
      confirmed_node_id: confirmedPathContext.confirmed_node_id,
      confirmed_node_content: confirmedPathContext.confirmed_node_content,
      confirmed_path_summary: confirmedPathContext.confirmed_path_summary ?? null,
      selected_plan_id: context.selected_plan_id,
      scope: resolvedScope,
      baseline_id: baselineId ?? null,
    })
    const needsGeneration = !context.prd || isPrdStale(context, confirmedPathContext)

    if (!needsGeneration) {
      completedGenerationKeyRef.current = generationKey
      return
    }
    if (inFlightGenerationKeyRef.current === generationKey) {
      return
    }
    if (completedGenerationKeyRef.current === generationKey) {
      return
    }
    inFlightGenerationKeyRef.current = generationKey

    const payload: PrdInput = {
      idea_seed: context.idea_seed,
      ...confirmedPathContext,
      selected_plan_id: context.selected_plan_id,
      scope: resolvedScope,
    }

    let cancelled = false
    setLoading(true)
    setErrorMessage(null)

    const run = async () => {
      try {
        const envelope = await postIdeaScopedAgent<PrdInput & { version: number }, PrdOutput>(
          activeIdeaId,
          'prd',
          {
            ...payload,
            version: activeIdea.version,
          }
        )
        const parsed = prdOutputSchema.safeParse(envelope.data)
        if (!parsed.success) {
          throw new Error('PRD payload shape mismatch.')
        }

        if (!cancelled) {
          completedGenerationKeyRef.current = generationKey
          setIdeaVersion(activeIdeaId, envelope.idea_version)
          setPrd(parsed.data)
        }
      } catch (error) {
        if (inFlightGenerationKeyRef.current === generationKey) {
          inFlightGenerationKeyRef.current = null
        }
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Request failed. Please try again.'
          setErrorMessage(message)
          toast.error(message)
        }
      } finally {
        if (inFlightGenerationKeyRef.current === generationKey) {
          inFlightGenerationKeyRef.current = null
        }
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      if (inFlightGenerationKeyRef.current === generationKey) {
        inFlightGenerationKeyRef.current = null
      }
    }
  }, [
    activeIdea,
    activeIdeaId,
    baselineId,
    canOpen,
    confirmedPathContext,
    context,
    resolvedScope,
    setIdeaVersion,
    setPrd,
  ])

  if (!canOpen) {
    return (
      <main>
        <section className="mx-auto mt-6 w-full max-w-4xl px-6">
          <GuardPanel
            title="PRD context not ready"
            description="Complete Scope Freeze before opening the PRD page."
          />
        </section>
      </main>
    )
  }

  return (
    <main>
      <PrdView
        prd={context.prd}
        context={context}
        loading={loading}
        errorMessage={errorMessage}
        scopeNotice={scopeNotice}
      />
    </main>
  )
}
