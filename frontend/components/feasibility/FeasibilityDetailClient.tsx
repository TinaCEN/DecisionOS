'use client'

import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { GuardPanel } from '../common/GuardPanel'
import { PlanDetail } from './PlanDetail'
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
  const context = useDecisionStore((state) => state.context)
  const setPlan = useDecisionStore((state) => state.plan)
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
          onClick={() => {
            setPlan(plan.id)
            toast.success('Plan confirmed')
            const routeIdeaId = resolveIdeaIdForRouting(pathname, activeIdeaId)
            router.push(routeIdeaId ? buildIdeaStepHref(routeIdeaId, 'scope-freeze') : '/ideas')
          }}
          className="rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Confirm This Plan
        </button>
      </div>
    </section>
  )
}
