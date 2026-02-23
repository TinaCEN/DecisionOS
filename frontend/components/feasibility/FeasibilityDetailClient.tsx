'use client'

import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { PlanDetail } from './PlanDetail'
import { ApiError, patchIdeaContext } from '../../lib/api'
import { buildIdeaStepHref, resolveIdeaIdForRouting } from '../../lib/idea-routes'
import { useIdeasStore } from '../../lib/ideas-store'
import { useDecisionStore } from '../../lib/store'

type FeasibilityDetailClientProps = {
  planId: string
}

export function FeasibilityDetailClient({ planId }: FeasibilityDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const activeIdeaId = useIdeasStore((state) => state.activeIdeaId)
  const activeIdea = useIdeasStore(
    (state) => state.ideas.find((idea) => idea.id === state.activeIdeaId) ?? null
  )
  const setIdeaVersion = useIdeasStore((state) => state.setIdeaVersion)
  const loadIdeaDetail = useIdeasStore((state) => state.loadIdeaDetail)
  const context = useDecisionStore((state) => state.context)
  const setPlan = useDecisionStore((state) => state.plan)
  const replaceContext = useDecisionStore((state) => state.replaceContext)
  const plan = context.feasibility?.plans.find((item) => item.id === planId) ?? null

  if (!context.feasibility) {
    return (
      <GuardPanel
        title="No feasibility context"
        description="Generate and select a feasibility plan before opening this page."
      />
    )
  }

  if (!plan) {
    return (
      <GuardPanel
        title="Plan not found"
        description="This plan is not in the current feasibility result. Return to the list and choose again."
      />
    )
  }

  return (
    <section>
      <PlanDetail plan={plan} />
      <div className="mx-auto mt-4 flex w-full max-w-3xl justify-end">
        <button
          type="button"
          onClick={async () => {
            setPlan(plan.id)
            const routeIdeaId = resolveIdeaIdForRouting(pathname, activeIdeaId)
            if (!routeIdeaId) {
              router.push('/ideas')
              return
            }
            if (!activeIdea) {
              toast.error('Missing active idea context')
              return
            }

            try {
              const detail = await patchIdeaContext(routeIdeaId, {
                version: activeIdea.version,
                context: {
                  ...context,
                  selected_plan_id: plan.id,
                },
              })
              setIdeaVersion(routeIdeaId, detail.version)
              replaceContext(detail.context)
              toast.success('Plan confirmed')
              router.push(buildIdeaStepHref(routeIdeaId, 'scope-freeze'))
            } catch (error) {
              if (
                error instanceof ApiError &&
                error.status === 409 &&
                error.code === 'IDEA_VERSION_CONFLICT'
              ) {
                const latest = await loadIdeaDetail(routeIdeaId)
                if (latest) {
                  replaceContext(latest.context)
                  setIdeaVersion(routeIdeaId, latest.version)
                }
                toast.error('Idea changed in another session. Reloaded latest data.')
                return
              }

              const message =
                error instanceof Error ? error.message : 'Failed to confirm this plan.'
              toast.error(message)
            }
          }}
          className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Confirm This Plan
        </button>
      </div>
    </section>
  )
}
