'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { PlanCards } from './PlanCards'
import { postIdeaScopedAgent } from '../../lib/api'
import { canRunFeasibility } from '../../lib/guards'
import { useIdeasStore } from '../../lib/ideas-store'
import { isSseEventError, streamPost } from '../../lib/sse'
import {
  agentEnvelopeSchema,
  feasibilityOutputSchema,
  type FeasibilityInput,
  type FeasibilityOutput,
  type FeasibilityPlan,
} from '../../lib/schemas'
import { useDecisionStore } from '../../lib/store'

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function FeasibilityPage() {
  const context = useDecisionStore((state) => state.context)
  const setFeasibility = useDecisionStore((state) => state.feasibility)
  const activeIdeaId = useIdeasStore((state) => state.activeIdeaId)
  const activeIdea = useIdeasStore(
    (state) => state.ideas.find((idea) => idea.id === state.activeIdeaId) ?? null
  )
  const setIdeaVersion = useIdeasStore((state) => state.setIdeaVersion)
  const [plans, setPlans] = useState<FeasibilityPlan[]>(context.feasibility?.plans ?? [])
  const [loading, setLoading] = useState(false)
  const [progressPct, setProgressPct] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)
  const canOpen = canRunFeasibility(context)

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

  const directionText = selectedDirection
    ? `${selectedDirection.title} - ${selectedDirection.one_liner}`
    : ''

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (context.feasibility?.plans) {
      setPlans(context.feasibility.plans)
    }
  }, [context.feasibility])

  useEffect(() => {
    if (!canOpen || !context.idea_seed || !context.selected_direction_id || !context.path_id) {
      return
    }

    const payload: FeasibilityInput = {
      idea_seed: context.idea_seed,
      direction_id: context.selected_direction_id,
      direction_text: directionText,
      path_id: context.path_id,
    }
    if (!activeIdeaId || !activeIdea) {
      setErrorMessage('Missing active idea context')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setErrorMessage(null)
    setPlans([])
    setProgressPct(0)
    setLoading(true)

    let streamedDonePayload: unknown = null

    const run = async () => {
      try {
        let shouldFallback = false

        try {
          await streamPost(
            `/ideas/${activeIdeaId}/agents/feasibility/stream`,
            { ...payload, version: activeIdea.version },
            {
              onProgress: (data) => {
                if (
                  mountedRef.current &&
                  typeof data === 'object' &&
                  data !== null &&
                  'pct' in data
                ) {
                  const pct = Number((data as { pct: number }).pct)
                  setProgressPct(Number.isFinite(pct) ? pct : 0)
                }
              },
              onPartial: (data) => {
                if (
                  !mountedRef.current ||
                  typeof data !== 'object' ||
                  data === null ||
                  !('plan' in data)
                ) {
                  return
                }

                const parsed = feasibilityOutputSchema.shape.plans.element.safeParse(
                  (data as { plan: unknown }).plan
                )
                if (!parsed.success) {
                  return
                }

                setPlans((prev) => {
                  if (prev.some((item) => item.id === parsed.data.id)) {
                    return prev
                  }
                  return [...prev, parsed.data]
                })
              },
              onDone: (data) => {
                streamedDonePayload = data
              },
            },
            controller.signal
          )

          const envelope = agentEnvelopeSchema.safeParse(streamedDonePayload)
          if (!envelope.success) {
            throw new Error('SSE ended without done payload.')
          }

          const parsedData = feasibilityOutputSchema.safeParse(envelope.data.data)
          if (!parsedData.success) {
            throw new Error('Feasibility payload shape mismatch.')
          }

          const streamedOutput: FeasibilityOutput = parsedData.data
          setIdeaVersion(activeIdeaId, envelope.data.idea_version)

          if (mountedRef.current) {
            setPlans(streamedOutput.plans)
          }
          setFeasibility(streamedOutput)
        } catch (streamError) {
          if (isAbortError(streamError)) {
            return
          }
          if (isSseEventError(streamError)) {
            throw streamError
          }
          shouldFallback = true
        }

        if (shouldFallback) {
          toast.message('SSE unavailable, fallback to JSON')
          const envelope = await postIdeaScopedAgent<
            FeasibilityInput & { version: number },
            FeasibilityOutput
          >(activeIdeaId, 'feasibility', {
            ...payload,
            version: activeIdea.version,
          })
          setIdeaVersion(activeIdeaId, envelope.idea_version)
          const parsed = feasibilityOutputSchema.safeParse(envelope.data)

          if (!parsed.success) {
            throw new Error('Feasibility payload shape mismatch.')
          }

          if (mountedRef.current) {
            setPlans(parsed.data.plans)
          }
          setFeasibility(parsed.data)
        }
      } catch (error) {
        if (!isAbortError(error) && mountedRef.current) {
          const message =
            error instanceof Error ? error.message : 'Request failed. Please try again.'
          setErrorMessage(message)
          toast.error(message)
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    void run()
  }, [
    activeIdea,
    activeIdeaId,
    canOpen,
    context.idea_seed,
    context.path_id,
    context.selected_direction_id,
    directionText,
    setFeasibility,
    setIdeaVersion,
  ])

  if (!canOpen) {
    return (
      <main className="p-6">
        <GuardPanel
          title="Missing context for Feasibility"
          description="Complete idea seed, direction, and path selection before entering Feasibility."
        />
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <h1 className="text-2xl font-bold">Feasibility</h1>
      <p className="mt-2 text-sm text-black/70">
        Direction: {selectedDirection?.title ?? 'N/A'} · Path: {context.path_id}
      </p>
      {loading ? <p className="mt-2 text-xs text-black/60">Streaming {progressPct}%</p> : null}
      {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
      {plans.length ? (
        <div className="mt-4">
          <PlanCards plans={plans} selectedPlanId={context.selected_plan_id} />
        </div>
      ) : (
        <section className="mt-4 rounded-xl border border-dashed border-black/30 p-6 text-sm text-black/60">
          {loading ? 'Generating feasibility plans...' : 'No feasibility plans available yet.'}
        </section>
      )}
    </main>
  )
}
